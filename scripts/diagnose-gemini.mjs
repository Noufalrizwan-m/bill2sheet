import {loadLocalGeminiEnv} from '../server/local-env.js';
import {geminiSchema} from '../shared/gemini.js';
const env=loadLocalGeminiEnv();
for(const schema of [true,false]){
 try{
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.timeout(60000),body:JSON.stringify({contents:[{parts:[{text:'Return a voucher JSON with voucher_date, paid_to, particulars and total null, row_amounts and unclear empty arrays.'}]}],generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:8192,...(schema?{responseJsonSchema:geminiSchema}:{})}})});
 const data=await response.json();console.log(JSON.stringify({schema,status:response.status,error:data.error?JSON.parse(JSON.stringify(data.error).split(env.GEMINI_API_KEY).join('[redacted]')):undefined,finishReason:data.candidates?.[0]?.finishReason}));
 }catch{console.log('Network request failed');process.exitCode=1;break;}
}
