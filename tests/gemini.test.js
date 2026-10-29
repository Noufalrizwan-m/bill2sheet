import test from 'node:test';import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createGeminiHandler} from './helpers/local-reader.js';
import {mapGeminiVoucher} from '../shared/gemini.js';
import {createVoucherWorkbook} from '../shared/voucher-export.js';
const GEMINI_MODEL='gemini-3.5-flash-lite';
const voucher={voucher_date:'27-06-2026',paid_to:'Gas Both Camp',particulars:null,row_amounts:[1725],total:1725,unclear:[]};
const image=Buffer.from([255,216,255,224,0,16,255,217]).toString('base64');
const res=()=>({setHeader(){},end(text){this.data=JSON.parse(text);}});
const req=(body={image})=>({method:'POST',headers:{},body});
const success=data=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(data)}]}}]})});
test('Gemini response maps into actual Excel fields and numeric amounts',async()=>{
 let options,url;const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'server-test-key'},request:async(u,o)=>{url=u;options=o;return success(voucher);}});
 const response=res();await handler(req({image:`data:image/jpeg;base64,${image}`}),response);
 assert.equal(response.statusCode,200);assert.equal(response.data.paid_to,'Gas Both Camp');assert.equal(response.data.total,1725);
 const wb=await createVoucherWorkbook([mapGeminiVoucher(response.data).bill]);assert.equal(wb.Sheets.Vouchers.B2.v,'Gas Both Camp');assert.equal(wb.Sheets.Vouchers.D2.v,1725);assert.equal(wb.Sheets.Vouchers.D2.t,'n');
 assert.ok(url.includes(GEMINI_MODEL));assert.equal(options.headers['x-goog-api-key'],'server-test-key');assert.ok(!JSON.stringify(response.data).includes('server-test-key'));
 const input=JSON.parse(options.body);assert.equal(input.contents[0].parts[0].inlineData.data,image);assert.equal(input.generationConfig.responseMimeType,'application/json');assert.equal(input.generationConfig.responseJsonSchema,undefined);assert.equal(input.generationConfig.temperature,0);assert.ok(input.generationConfig.maxOutputTokens>=2000);
});
test('unclear data remains null, unreadable row positions preserved, impossible dates flagged',()=>{
 const {bill}=mapGeminiVoucher({...voucher,voucher_date:'31-02-2026',row_amounts:[null,20],unclear:[{field:'total',note:'3 or 8'}]});
 assert.equal(bill.total,null);assert.equal(bill.date,null);assert.equal(bill.items[0].amount,null);assert.ok(bill.recognition_note.includes('3 or 8'));
 assert.throws(()=>mapGeminiVoucher({...voucher,total:'1,725'}));assert.throws(()=>mapGeminiVoucher({...voucher,paid_to:42}));
});
test('missing key pauses without making a provider call and status reveals no secret',async()=>{
 const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{},request:()=>{throw new Error('unexpected call');}});const response=res();await handler(req(),response);assert.equal(response.statusCode,503);assert.equal(response.data.pauseQueue,true);
 const status=res();await handler({method:'GET',headers:{}},status);assert.equal(status.data.configured,false);
});
test('quota errors exhaust six retries and remain available for manual retry',async()=>{
 let calls=0;const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'test'},request:async()=>{calls++;return {ok:false,status:429,text:async()=>JSON.stringify({error:{message:"Quota reached",status:"RESOURCE_EXHAUSTED"}})};}});const response=res();await handler(req(),response);assert.equal(calls,7);assert.equal(response.statusCode,429);assert.equal(response.data.pauseQueue,false);
});
test('malformed JSON, non-JPEG input, wrong methods and cross-origin requests are rejected',async()=>{
 const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'test'},request:()=>{throw new Error('unexpected call');}});
 for(const request of [req({image:'bad'}),req('{bad json')]){const response=res();await handler(request,response);assert.equal(response.statusCode,400);}
 const wrong=res();await handler({method:'DELETE',headers:{}},wrong);assert.equal(wrong.statusCode,405);
 const origin=res();await handler({...req(),headers:{origin:'https://other.example',host:'app.example'}},origin);assert.equal(origin.statusCode,403);
});
test('Vite raw request body is read and multipart response text is joined',async()=>{
 const request=Readable.from([JSON.stringify({image})]);request.method='POST';request.headers={};
 const text=JSON.stringify(voucher);const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'test'},request:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{thoughtSignature:'signature-only'},{text:'  '+text.slice(0,30),thoughtSignature:'extra-field'},{text:text.slice(30)+'  '}]}}]})})});
 const response=res();await handler(request,response);assert.equal(response.statusCode,200);
});
test('blocked, truncated, invalid and schema-wrong results never succeed as a blank voucher',async()=>{
 for(const data of [{promptFeedback:{blockReason:'OTHER'}},{candidates:[{finishReason:'MAX_TOKENS'}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'not JSON'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]}]){
 const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'test'},request:async()=>({ok:true,json:async()=>data})});const response=res();await handler(req(),response);assert.equal(response.statusCode,422);
 }
});
test('configured model is used without an allowlist and provider status/message survive',async()=>{
 for(const status of [400,403,404,429,503]){
 let url;const response=res();await createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_API_KEY:'private-test',GEMINI_MODEL:'gemini-future-flash'},request:async u=>{url=u;return {ok:false,status,text:async()=>JSON.stringify({error:{status:'PROVIDER_ERROR',message:'Exact provider message'}})};}})(req(),response);
 assert.ok(url.includes('gemini-future-flash'));assert.equal(response.statusCode,status);assert.equal(response.data.status,status);assert.ok(response.data.error.includes('Exact provider message'));
 }
});
test('missing model fails explicitly without silently choosing one',async()=>{
 const response=res();await createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_API_KEY:'private'},request:()=>{throw Error('Must not call');}})(req(),response);
 assert.equal(response.statusCode,503);assert.match(response.data.error,/GEMINI_MODEL/);
});
test('export skips blank photos, retains numeric zero, includes review notes and mismatch',async()=>{
 const {voucherWarnings}=await import('../shared/voucher.js');
 const {bill}=mapGeminiVoucher({...voucher,row_amounts:[3800],total:3300});
 assert.equal(bill.total,3300);assert.ok(voucherWarnings(bill).length);
 const workbook=await createVoucherWorkbook([{vendor:null,date:null,total:null,items:[]},bill,{...bill,vendor:'Zero',total:0,items:[]}]);
 const sheet=workbook.Sheets.Vouchers;
 assert.equal(sheet.F1.v,'Review notes');assert.equal(sheet.D2.v,3300);assert.equal(sheet.D3.v,0);assert.equal(sheet.D5.v,3300);assert.match(sheet.F2.v,/do not add up/);
});
test('busy retries alternate configured models with capped exponential jitter and safe logs',async()=>{
 const models=[],waits=[],logs=[];
 const handler=createGeminiHandler({env:{GEMINI_API_KEY:'secret-value',GEMINI_MODEL:'primary',GEMINI_FALLBACK_MODEL:'fallback'},random:()=>0.5,wait:async ms=>waits.push(ms),log:event=>logs.push(event),request:async(url,options)=>{
 models.push(decodeURIComponent(url.split('/models/')[1].split(':')[0]));
 const config=JSON.parse(options.body).generationConfig;
 assert.equal(config.thinkingConfig.thinkingLevel,'low');assert.equal(config.maxOutputTokens,2000);
 return {ok:false,status:models.length%2?503:429,text:async()=>JSON.stringify({error:{message:'Busy'}})};
 }});
 const response=res();await handler(req(),response);
 assert.deepEqual(models,['primary','fallback','primary','fallback','primary','fallback','primary']);
 assert.deepEqual(waits,[2250,4250,8250,16250,20250,20250]);
 assert.equal(response.data.retryable,true);assert.equal(response.data.pauseQueue,false);
 assert.equal(logs.length,7);for(const log of logs)assert.deepEqual(Object.keys(log),['status','model','attempt']);
 assert.ok(!JSON.stringify(logs).includes('secret-value'));
});
test('retry stops immediately after a successful response',async()=>{
 let calls=0;const response=res();await createGeminiHandler({env:{GEMINI_API_KEY:'secret',GEMINI_MODEL:'primary'},wait:async()=>{},log:()=>{},request:async()=>++calls===1?{ok:false,status:503,text:async()=>''}:success(voucher)})(req(),response);
 assert.equal(calls,2);assert.equal(response.statusCode,200);
});
