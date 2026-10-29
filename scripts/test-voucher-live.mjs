import {readFileSync} from 'node:fs';
import {loadLocalGeminiEnv} from '../server/local-env.js';
import {createGeminiHandler} from '../api/read-voucher.js';
const env=loadLocalGeminiEnv();
const response={setHeader(){},end(text){console.log(JSON.stringify({status:this.statusCode,result:JSON.parse(text.split(env.GEMINI_API_KEY).join('[redacted]'))}));}};
await createGeminiHandler({env,localDevelopment:true})({method:'POST',headers:{host:'localhost','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},body:{image:readFileSync('/private/tmp/bill2sheet-gemini-test.jpg').toString('base64')}},response);
