import test from 'node:test';
import assert from 'node:assert/strict';
import {sealData} from 'iron-session';
import {createGeminiHandler} from '../api/read-voucher.js';
import {createSessionHandler} from '../api/session.js';
import {createWindowLimit,ownerFingerprint} from '../server/access.js';
import {redactData} from '../server/http.js';

const env={VERCEL:'1',GEMINI_API_KEY:'fixture-provider-key-not-real',GEMINI_MODEL:'fixture-model',VOUCHERQUILL_ACCESS_PASSWORD:'fixture-owner-password-not-real',VOUCHERQUILL_SESSION_SECRET:'fixture-session-secret-at-least-32-characters'};
const image=Buffer.from([255,216,255,224,0,16,255,217]).toString('base64');
const voucher={voucher_date:null,paid_to:'Fixture supplier',particulars:null,row_amounts:[20],total:20,unclear:[]};
const allow=()=>({allowed:true});
function response(){return {headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=value;},getHeader(name){return this.headers[name.toLowerCase()];},end(raw){this.raw=raw;this.data=JSON.parse(raw);}};}
function request({method='POST',body={image},cookie,headers={}}={}){
 return {method,body,headers:{host:'voucher.example',origin:'https://voucher.example','x-forwarded-proto':'https','content-type':'application/json',...(cookie?{cookie}:{}),...headers},socket:{remoteAddress:'192.0.2.10'}};
}
async function signIn(){
 const res=response();await createSessionHandler({env,attemptLimit:allow,globalLimit:allow})(request({body:{password:env.VOUCHERQUILL_ACCESS_PASSWORD}}),res);
 assert.equal(res.statusCode,200);
 return {cookie:res.headers['set-cookie'][0].split(';')[0],res};
}
function reader(options={}){return createGeminiHandler({env,readMinuteLimit:allow,readHourLimit:allow,log:()=>{},request:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(voucher)}]}}]})}),...options});}

test('public read requests require an owner session; an Origin header is not authentication',async()=>{
 let calls=0;const handler=reader({request:async()=>{calls++;throw Error('must not call');}});
 for(const headers of [{},{cookie:'__Host-voucherquill-owner=forged'},{authorization:'Bearer fake'}]){
  const res=response();await handler(request({headers}),res);assert.equal(res.statusCode,401);assert.equal(res.data.pauseQueue,true);
 }
 assert.equal(calls,0);
 const status=response();await handler(request({method:'GET'}),status);
 assert.equal(status.data.authenticationRequired,true);assert.equal(status.data.variables,undefined);assert.equal(status.data.model,undefined);
});

test('default deployment fails closed without access configuration and ignores spoofed local headers',async()=>{
 let calls=0;const handler=reader({env:{VERCEL:'1',GEMINI_API_KEY:env.GEMINI_API_KEY,GEMINI_MODEL:env.GEMINI_MODEL},request:async()=>{calls++;}});
 const res=response();await handler(request({headers:{'x-forwarded-for':'127.0.0.1','x-real-ip':'127.0.0.1'}}),res);
 assert.equal(res.statusCode,503);assert.equal(calls,0);
 const spoof=request({headers:{host:'localhost',origin:'http://localhost'}});spoof.socket.remoteAddress='127.0.0.1';
 const notDev=response();await handler(spoof,notDev);assert.equal(notDev.statusCode,403);
});

test('owner sign-in uses encrypted HttpOnly Secure SameSite cookies, never returns credentials',async()=>{
 const {cookie,res}=await signIn();
 assert.match(cookie,/^__Host-voucherquill-owner=/);
 const header=res.headers['set-cookie'][0];
 for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(header.includes(flag));
 assert.ok(!header.includes('Domain='));
 for(const value of [env.GEMINI_API_KEY,env.VOUCHERQUILL_ACCESS_PASSWORD,env.VOUCHERQUILL_SESSION_SECRET]){assert.ok(!header.includes(value));assert.ok(!res.raw.includes(value));}
 const reading=response();await reader()(request({cookie}),reading);assert.equal(reading.statusCode,200);
 const signedStatus=response();await createSessionHandler({env})(request({method:'GET',cookie}),signedStatus);assert.equal(signedStatus.data.authenticated,true);
});

test('cross-site, missing-Origin and non-JSON reads cannot call the provider even with a cookie',async()=>{
 const {cookie}=await signIn();let calls=0;
 const handler=reader({request:async()=>{calls++;}});
 for(const headers of [{origin:'https://other.example'},{origin:undefined},{origin:'null'},{'sec-fetch-site':'cross-site'}]){
  const res=response();await handler(request({cookie,headers}),res);assert.equal(res.statusCode,403);
 }
 const nonJSON=response();await handler(request({cookie,headers:{'content-type':'text/plain'}}),nonJSON);assert.equal(nonJSON.statusCode,415);
 assert.equal(calls,0);
});

test('expired and tampered cookies, and a changed owner password, are rejected',async()=>{
 const {cookie}=await signIn();
 const seal=await sealData({owner:ownerFingerprint(env),expires:Date.now()-1000},{password:env.VOUCHERQUILL_SESSION_SECRET,ttl:3600});
 for(const candidate of [cookie.slice(0,100)+(cookie[100]==='a'?'b':'a')+cookie.slice(101),`__Host-voucherquill-owner=${encodeURIComponent(seal)}`]){
  const res=response();await reader()(request({cookie:candidate}),res);assert.equal(res.statusCode,401);
 }
 const res=response();await reader({env:{...env,VOUCHERQUILL_ACCESS_PASSWORD:'different-fixture-owner-password'}})(request({cookie}),res);assert.equal(res.statusCode,401);
});

test('login validates input, blocks insecure transport and limits guesses',async()=>{
 const handler=createSessionHandler({env,globalLimit:allow,attemptLimit:createWindowLimit({limit:2,windowMs:60_000})});
 for(const body of [{password:'wrong'}, {password:{nested:'wrong'}}]){const res=response();await handler(request({body}),res);assert.equal(res.statusCode,401);}
 const blocked=response();await handler(request({body:{password:env.VOUCHERQUILL_ACCESS_PASSWORD}}),blocked);assert.equal(blocked.statusCode,429);assert.ok(blocked.headers['retry-after']);
 const insecure=response();await handler(request({headers:{origin:'http://voucher.example','x-forwarded-proto':'http'}}),insecure);assert.equal(insecure.statusCode,426);
 const oversized=response();await createSessionHandler({env,attemptLimit:allow,globalLimit:allow})(request({body:{password:'a'.repeat(5000)}}),oversized);assert.equal(oversized.statusCode,400);
 const cross=response();await handler(request({headers:{origin:'https://other.example'}}),cross);assert.equal(cross.statusCode,403);
 const logout=response();const {cookie}=await signIn();await handler(request({method:'DELETE',cookie}),logout);assert.equal(logout.statusCode,200);assert.ok(logout.headers['set-cookie'][0].includes('Max-Age=0'));
});

test('admitted reads are rate-limited before provider calls and retain retry guidance',async()=>{
 const {cookie}=await signIn();let calls=0;
 const handler=reader({readMinuteLimit:createWindowLimit({limit:1,windowMs:60_000}),request:async()=>{calls++;return {ok:false,status:400,text:async()=>''};}});
 const first=response();await handler(request({cookie}),first);
 const next=response();await handler(request({cookie}),next);
 assert.equal(calls,1);assert.equal(next.statusCode,429);assert.equal(next.data.pauseQueue,true);assert.ok(next.headers['retry-after']);
});

test('two in-flight reads cap concurrency and completed work releases its slot',async()=>{
 const {cookie}=await signIn();const releases=[];let calls=0;
 const handler=reader({request:async()=>{calls++;return new Promise(resolve=>releases.push(()=>resolve({ok:false,status:400,text:async()=>''})));}});
 const one=handler(request({cookie}),response()),two=handler(request({cookie}),response());
 while(releases.length<2)await new Promise(resolve=>setImmediate(resolve));
 const extra=response();await handler(request({cookie}),extra);assert.equal(extra.statusCode,429);assert.equal(calls,2);
 releases.forEach(release=>release());await Promise.all([one,two]);
 const after=response();await reader()(request({cookie}),after);assert.equal(after.statusCode,200);
});

test('provider failures redact actual, escaped and URL-encoded secrets',async()=>{
 const {cookie}=await signIn();const res=response();
 const message=Object.values(env).filter(v=>v.includes('fixture')).join(' ');
 await reader({request:async()=>({ok:false,status:400,text:async()=>JSON.stringify({error:{message,status:env.GEMINI_API_KEY}})})})(request({cookie}),res);
 for(const value of [env.GEMINI_API_KEY,env.VOUCHERQUILL_ACCESS_PASSWORD,env.VOUCHERQUILL_SESSION_SECRET])assert.ok(!res.raw.includes(value));
 assert.ok(res.raw.includes('[redacted]'));
 const special={...env,VOUCHERQUILL_ACCESS_PASSWORD:'quoted-"secret"-\\-fixture'};
 const clean=redactData({message:special.VOUCHERQUILL_ACCESS_PASSWORD+' '+encodeURIComponent(special.VOUCHERQUILL_ACCESS_PASSWORD)},special);
 assert.equal(clean.message,'[redacted] [redacted]');
});

test('local convenience requires an explicit dev flag, a loopback peer and a loopback Host',async()=>{
 const handler=reader({localDevelopment:true});
 const local=request({headers:{host:'localhost',origin:'http://localhost','x-forwarded-proto':'http'}});local.socket.remoteAddress='127.0.0.1';
 const prod=response();await handler(local,prod);assert.equal(prod.statusCode,401,'VERCEL must disable local convenience');
 const dev=response();await reader({localDevelopment:true,env:{GEMINI_API_KEY:env.GEMINI_API_KEY,GEMINI_MODEL:env.GEMINI_MODEL}})(local,dev);assert.equal(dev.statusCode,200);
 local.socket.remoteAddress='192.0.2.4';const lan=response();await reader({localDevelopment:true,env:{GEMINI_API_KEY:env.GEMINI_API_KEY,GEMINI_MODEL:env.GEMINI_MODEL}})(local,lan);assert.equal(lan.statusCode,503);
});

test('window limits reset after expiry and refuse new keys when memory is full',()=>{
 let time=0;const limit=createWindowLimit({limit:1,windowMs:1000,maxEntries:1,now:()=>time});
 assert.equal(limit('a').allowed,true);assert.equal(limit('b').allowed,false);assert.equal(limit('a').allowed,false);time=1001;assert.equal(limit('b').allowed,true);
});
