import {readFileSync} from 'node:fs';
import {loadLocalGeminiEnv} from '../server/local-env.js';
import {createGeminiHandler} from '../api/read-voucher.js';
const env=loadLocalGeminiEnv();
const response={setHeader(){},end(text){console.log(JSON.stringify({status:this.statusCode,result:JSON.parse(text.split(env.GEMINI_API_KEY).join('[redacted]'))}));}};
await createGeminiHandler({env})({method:'POST',headers:{},body:{image:readFileSync('/private/tmp/bill2sheet-gemini-test.jpg').toString('base64')}},response);
