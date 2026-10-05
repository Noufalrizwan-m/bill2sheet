import {loadLocalGeminiEnv} from '../server/local-env.js';
const env=loadLocalGeminiEnv();
const model=env.GEMINI_FALLBACK_MODEL||env.GEMINI_MODEL;
try{
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.timeout(25000),body:JSON.stringify({contents:[{parts:[{text:'Return JSON with ok true.'}]}],generationConfig:{responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'low'},temperature:0,maxOutputTokens:2000}})});
 console.log(JSON.stringify({status:response.status,model,attempt:1}));
 const data=await response.json();
 if(!response.ok)process.exitCode=1;
 // No provider error bodies or private configuration values are logged.
}catch{console.log(JSON.stringify({status:'network-or-timeout',model,attempt:1}));process.exitCode=1;}
