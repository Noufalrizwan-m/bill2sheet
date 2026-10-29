export function respond(res,status,data){
 res.statusCode=status;
 res.setHeader('Content-Type','application/json');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.end(JSON.stringify(data));
}

export async function readJSON(req,limit){
 const length=Number(req.headers?.['content-length']);
 if(Number.isFinite(length)&&length>limit)throw new Error('size');
 let source;
 if(req.body!==undefined){source=typeof req.body==='string'?req.body:JSON.stringify(req.body);}
 else{
  let size=0;const chunks=[];
  for await(const chunk of req){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;if(size>limit)throw new Error('size');chunks.push(bytes);}
  source=Buffer.concat(chunks).toString();
 }
 if(typeof source!=='string'||Buffer.byteLength(source)>limit)throw new Error('size');
 const parsed=JSON.parse(source);
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('object');
 return parsed;
}

export function redact(value,env){
 let result=String(value);
 for(const name of ['GEMINI_API_KEY','VOUCHERQUILL_ACCESS_PASSWORD','VOUCHERQUILL_SESSION_SECRET']){
  const secret=env[name]?.trim();
  if(secret)for(const representation of new Set([secret,encodeURIComponent(secret),JSON.stringify(secret).slice(1,-1)]))result=result.split(representation).join('[redacted]');
 }
 return result.replace(/AIza[0-9A-Za-z_-]{35}/g,'[redacted]');
}

export function redactData(value,env){
 if(typeof value==='string')return redact(value,env);
 if(Array.isArray(value))return value.map(item=>redactData(item,env));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,redactData(item,env)]));
 return value;
}
