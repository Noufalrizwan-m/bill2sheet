import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {parseEnv} from 'node:util';

export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const names=['GEMINI_API_KEY','GEMINI_MODEL','GEMINI_FALLBACK_MODEL','VOUCHERQUILL_ACCESS_PASSWORD','VOUCHERQUILL_SESSION_SECRET'];

// Local tooling only: never imported by the browser or the deployed function.
// A nonempty .env.local value wins over an inherited shell value locally.
export function loadLocalGeminiEnv({root=projectRoot,inherited=process.env}={}){
 let local={};
 try{local=parseEnv(readFileSync(join(root,'.env.local'),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw new Error('Cannot read .env.local in the project root.');}
 return Object.fromEntries(names.map(name=>[name,local[name]?.trim()||inherited[name]?.trim()||'']));
}
