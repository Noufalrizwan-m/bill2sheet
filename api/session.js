import {respond,readJSON} from '../server/http.js';
import {accessState,accessConfigured,ownerSession,ownerFingerprint,matchesPassword,sameOrigin,secureRequest,trustedLocal,createWindowLimit,clientId} from '../server/access.js';

const attempts=createWindowLimit({limit:10,windowMs:15*60*1000});
const globalAttempts=createWindowLimit({limit:100,windowMs:15*60*1000});
export function createSessionHandler({env=process.env,localDevelopment=false,now=Date.now,attemptLimit=attempts,globalLimit=globalAttempts}={}){
 return async(req,res)=>{
  try{
   if(req.method==='GET'){
    const state=await accessState(req,res,{env,localDevelopment,now});
    return respond(res,200,{authenticated:state.authorized,accessConfigured:state.configured,local:state.local});
   }
   if(!['POST','DELETE'].includes(req.method))return respond(res,405,{error:'Method not allowed.'});
   const local=env.VERCEL!=='1'&&trustedLocal(req,localDevelopment),secure=secureRequest(req,env);
   if(!sameOrigin(req,{allowMissing:local,secure}))return respond(res,403,{error:'Open this site directly to sign in.'});
   if(!secure&&!local)return respond(res,426,{error:'Use the HTTPS address to sign in.'});
   if(!accessConfigured(env))return respond(res,503,{error:'Owner access has not been configured on this server.'});
   if(req.method==='DELETE'){
    const session=await ownerSession(req,res,env,{secure});session.destroy();return respond(res,200,{authenticated:false});
   }
   for(const check of [globalLimit('all'),attemptLimit(clientId(req,env))])if(!check.allowed){res.setHeader('Retry-After',String(check.retryAfter));return respond(res,429,{error:'Too many sign-in attempts. Try again later.'});}
   if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')return respond(res,415,{error:'Send JSON.'});
   let input;try{input=await readJSON(req,4096);}catch{return respond(res,400,{error:'Invalid sign-in request.'});}
   if(!matchesPassword(input.password,env))return respond(res,401,{error:'The access password is incorrect.'});
   const session=await ownerSession(req,res,env,{secure});
   session.owner=ownerFingerprint(env);session.expires=now()+8*60*60*1000;
   await session.save();return respond(res,200,{authenticated:true});
  }catch{return respond(res,503,{error:'Owner access is temporarily unavailable.'});}
 };
}
export default createSessionHandler();
