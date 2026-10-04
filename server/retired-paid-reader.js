import { visionPrompt, visionSchema, validateVision } from '../shared/vision.js';
export const config = { maxDuration: 120 };
function reply(res, status, data) { res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data)); }
async function readBody(req) {
  if(req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>3_000_000)throw new Error('Photo is too large.');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString());
}
export function createHandler({ env = process.env, request = fetch } = {}) {
  return async function handler(req,res) {
    if(req.method==='GET') return reply(res,200,{configured:Boolean(env.OPENAI_API_KEY),provider:'OpenAI'});
    if(req.method!=='POST') return reply(res,405,{error:'Method not allowed.'});
    if(req.headers.origin) { try { if(new URL(req.headers.origin).host!==req.headers.host) return reply(res,403,{error:'Use the app to read a bill.'}); } catch { return reply(res,403,{error:'Invalid request origin.'}); } }
    if(!env.OPENAI_API_KEY) return reply(res,503,{error:'AI reading needs setup: add OPENAI_API_KEY to the server environment. Your photo is saved; retry after setup.'});
    try {
      const {image}=await readBody(req);
      if(typeof image!=='string'||image.length>2_500_000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image))return reply(res,400,{error:'Choose a valid photo and retry.'});
      const response=await request('https://api.openai.com/v1/responses',{
        method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(100_000),body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1',store:false,
          instructions:visionPrompt,input:[{role:'user',content:[{type:'input_text',text:'Read this voucher carefully.'},{type:'input_image',image_url:image,detail:'high'}]}],
          text:{format:{type:'json_schema',name:'voucher',strict:true,schema:visionSchema}},max_output_tokens:6000})
      });
      if(!response.ok)return reply(res,response.status===429?429:502,{error:response.status===429?'AI limit reached. Wait and retry.':response.status===401?'The server API key is invalid. Update it and retry.':'The AI service could not read this photo. Retry shortly.'});
      const data=await response.json();
      if(data.status!=='completed')throw new Error('The AI reading was incomplete. Retry with a clearer photo.');
      const text=(data.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('');
      const bill=validateVision(JSON.parse(text));
      return reply(res,200,{bill,text:bill.raw_text||''});
    }catch(error){return reply(res,502,{error:error.name==='TimeoutError'?'AI reading timed out. Your photo is saved; retry.':'Could not read the photo reliably. Your photo is saved; retry or enter the details manually.'});}
  };
}
export default createHandler();
