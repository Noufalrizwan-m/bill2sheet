import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {getIronSession} from 'iron-session';

const loopbacks=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
export function trustedLocal(req,localDevelopment=false){
 if(!localDevelopment||!loopbacks.has(req.socket?.remoteAddress))return false;
 try{return ['localhost','127.0.0.1','[::1]'].includes(new URL(`http://${req.headers.host}`).hostname);}
 catch{return false;}
}
export function secureRequest(req,env){return Boolean(req.socket?.encrypted)||(env.VERCEL==='1'&&req.headers['x-forwarded-proto']==='https');}
export function sameOrigin(req,{allowMissing=false,secure=false}={}){
 const site=req.headers['sec-fetch-site'];
 if(site&&site!=='same-origin'&&site!=='none')return false;
 const origin=req.headers.origin;
 if(!origin)return allowMissing;
 try{const url=new URL(origin);return url.host===req.headers.host&&url.protocol===(secure?'https:':'http:')&&url.origin===origin;}
 catch{return false;}
}
export function accessConfigured(env){
 const password=env.VOUCHERQUILL_ACCESS_PASSWORD||'',secret=env.VOUCHERQUILL_SESSION_SECRET||'';
 return password.length>=16&&password.length<=256&&secret.length>=32&&secret.length<=256&&password!==secret&&password!==env.GEMINI_API_KEY&&secret!==env.GEMINI_API_KEY;
}
export const ownerFingerprint=env=>createHmac('sha256',env.VOUCHERQUILL_SESSION_SECRET).update(env.VOUCHERQUILL_ACCESS_PASSWORD).digest('hex');
export function matchesPassword(input,env){
 if(typeof input!=='string'||input.length>256)return false;
 const hash=value=>createHash('sha256').update(value).digest();
 return timingSafeEqual(hash(input),hash(env.VOUCHERQUILL_ACCESS_PASSWORD));
}
export async function ownerSession(req,res,env,{secure=true}={}){
 return getIronSession(req,res,{
  cookieName:secure?'__Host-voucherquill-owner':'voucherquill-owner-local',
  password:env.VOUCHERQUILL_SESSION_SECRET,ttl:8*60*60,
  cookieOptions:{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge:8*60*60},
 });
}
export async function accessState(req,res,{env,localDevelopment=false,now=Date.now}={}){
 const local=env.VERCEL!=='1'&&trustedLocal(req,localDevelopment);
 if(local)return {authorized:true,local:true,configured:accessConfigured(env)};
 if(!accessConfigured(env))return {authorized:false,local:false,configured:false};
 if(!secureRequest(req,env))return {authorized:false,local:false,configured:true};
 const session=await ownerSession(req,res,env);
 return {authorized:session.owner===ownerFingerprint(env)&&Number.isFinite(session.expires)&&session.expires>now(),local:false,configured:true};
}

// Per-process safeguards, NOT a shared serverless quota. Authentication is mandatory
// regardless of these counters. Add a shared edge/WAF limit before wider use.
export function createWindowLimit({limit,windowMs,maxEntries=2048,now=Date.now}){
 const entries=new Map();
 return key=>{
  const time=now();
  for(const [id,entry] of entries)if(entry.until<=time)entries.delete(id);
  let entry=entries.get(key);
  if(!entry){if(entries.size>=maxEntries)return {allowed:false,retryAfter:Math.ceil(windowMs/1000)};entry={used:0,until:time+windowMs};entries.set(key,entry);}
  if(entry.used>=limit)return {allowed:false,retryAfter:Math.max(1,Math.ceil((entry.until-time)/1000))};
  entry.used++;return {allowed:true};
 };
}
export function clientId(req,env){
 const address=env.VERCEL==='1'?req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim():req.socket?.remoteAddress;
 // Only a bounded hash is retained; no addresses are logged or returned.
 return createHash('sha256').update(String(address||'unknown')).digest('hex');
}
