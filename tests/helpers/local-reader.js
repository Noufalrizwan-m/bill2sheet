import {createGeminiHandler as createHandler} from '../../api/read-voucher.js';
// Provider contract tests exercise the explicitly trusted local CLI path.
// Public authentication is tested separately with the real default policy.
export function createGeminiHandler(options){
 const handler=createHandler({localDevelopment:true,readMinuteLimit:()=>({allowed:true}),readHourLimit:()=>({allowed:true}),...options});
 return (req,res)=>{
  req.headers={host:'localhost','content-type':'application/json',...req.headers};
  req.socket??={remoteAddress:'127.0.0.1'};
  return handler(req,res);
 };
}
