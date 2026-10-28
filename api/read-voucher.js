import {setTimeout as delay} from 'node:timers/promises';
import {PROMPT,mapGeminiVoucher} from '../shared/gemini.js';
export const config={maxDuration:240};
const limit=2_600_000;
function respond(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
async function body(req){
 if(req.body!==undefined){const source=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(source)>limit)throw new Error('size');return typeof req.body==='string'?JSON.parse(source):req.body;}
 let size=0;const chunks=[];for await(const part of req){const bytes=Buffer.isBuffer(part)?part:Buffer.from(part);size+=bytes.length;if(size>limit)throw new Error('size');chunks.push(bytes);}return JSON.parse(Buffer.concat(chunks).toString());
}
export function createGeminiHandler({env=process.env,request=fetch,wait=delay,random=Math.random,log=console.info}={}){
 return async(req,res)=>{
  const model=env.GEMINI_MODEL?.trim();
  const missing=['GEMINI_API_KEY','GEMINI_MODEL'].filter(name=>!env[name]?.trim());
  if(req.method==='GET')return respond(res,200,{configured:missing.length===0,variables:{GEMINI_API_KEY:!missing.includes('GEMINI_API_KEY'),GEMINI_MODEL:!missing.includes('GEMINI_MODEL')},missing,model,provider:'Gemini'});
  if(req.method!=='POST')return respond(res,405,{error:'Method not allowed.'});
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return respond(res,403,{error:'Use VoucherQuill to read a photo.'});}catch{return respond(res,403,{error:'Invalid origin.'});}}
  if(missing.length)return respond(res,503,{error:`${missing.join(' and ')} ${missing.length===1?'is':'are'} missing on the server. Locally, check .env.local in the running project. On Vercel, add the variables for this deployment environment and redeploy.`,status:503,missing,pauseQueue:true});
  let image;
  try{const input=await body(req);image=input?.image;if(typeof image!=='string')throw new Error('image');image=image.replace(/^data:image\/jpeg;base64,/,'');if(!image||image.length>2_500_000||image.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(image))throw new Error('image');const bytes=Buffer.from(image,'base64');if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error('image');}
  catch{return respond(res,400,{error:'Invalid photo. Upload a JPEG or use the camera/HEIC conversion in VoucherQuill.'});}
  const controller=new AbortController();
  const closed=()=>{if(!res.writableEnded)controller.abort();};
  res.on?.('close',closed);
  try{
   const fallback=env.GEMINI_FALLBACK_MODEL?.trim();
   let response;
   for(let attempt=1;attempt<=7;attempt++){
    const selected=fallback&&attempt%2===0?fallback:model;
    response=await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selected)}:generateContent`,{
     method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),
     body:JSON.stringify({systemInstruction:{parts:[{text:PROMPT}]},contents:[{role:'user',parts:[{inlineData:{mimeType:'image/jpeg',data:image}},{text:'Read the foreground voucher.'}]}],generationConfig:{responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'low'},temperature:0,maxOutputTokens:2000}})
    });
    log({status:response.status,model:selected,attempt});
    if(response.ok)break;
    const raw=await response.text();
    let detail;try{detail=JSON.parse(raw).error;}catch{}
    const message=String(detail?.message||raw||response.statusText||'Gemini request failed').split(env.GEMINI_API_KEY).join('[redacted]');
    if([503,429].includes(response.status)){
     if(attempt<7){await wait(Math.min(2000*2**(attempt-1),20000)+Math.floor(random()*500),undefined,{signal:controller.signal});continue;}
     return respond(res,response.status,{error:`Gemini is busy or its quota is unavailable after 7 attempts. Photo saved in Retry failed. Try again later. ${message}`,status:response.status,providerStatus:detail?.status||null,retryable:true,pauseQueue:false});
    }
    return respond(res,response.status,{error:message,status:response.status,providerStatus:detail?.status||null,pauseQueue:[401,403,404].includes(response.status)});
   }
   const data=await response.json(),candidate=data.candidates?.[0];
   if(data.promptFeedback?.blockReason||candidate?.finishReason!=='STOP')return respond(res,422,{error:'Gemini did not return a complete reading. Crop the voucher and retry.'});
   const text=(candidate.content?.parts||[]).map(p=>p.text||'').join('').trim();
   let result;try{result=mapGeminiVoucher(JSON.parse(text));}catch{return respond(res,422,{error:'Gemini returned invalid voucher data. The photo is saved; retry or enter the values manually.'});}
   return respond(res,200,JSON.parse(result.text));
  }catch{if(!controller.signal.aborted)return respond(res,502,{error:'Gemini could not be reached or timed out. Photo saved in Retry failed.',retryable:true,pauseQueue:false});}finally{res.off?.('close',closed);}
 };
}
export default createGeminiHandler();
