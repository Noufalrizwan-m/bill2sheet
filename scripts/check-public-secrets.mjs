import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {parseEnv} from 'node:util';
import {projectRoot} from '../server/local-env.js';

// Print locations only. Never print matched strings or environment values.
const sensitive=['GEMINI_API_KEY','VOUCHERQUILL_ACCESS_PASSWORD','VOUCHERQUILL_SESSION_SECRET'];
const environments=[process.env];
for(const name of readdirSync(projectRoot))if(name.startsWith('.env')&&name!=='.env.example'){
 try{environments.push(parseEnv(readFileSync(join(projectRoot,name),'utf8')));}catch{console.error('Cannot scan an environment file.');process.exit(1);}
}
const secrets=[...new Set(environments.flatMap(env=>sensitive.map(name=>env[name]).filter(value=>typeof value==='string'&&value.length>=12)))];
const findings=new Set();
for(const env of environments)for(const [name,value] of Object.entries(env))if(value&&/^(VITE_|NEXT_PUBLIC_).*(?:SECRET|PRIVATE|PASSWORD|API_KEY|ACCESS_TOKEN)/i.test(name))findings.add(`Public environment variable: ${name}`);
function scan(path){
 for(const item of readdirSync(path,{withFileTypes:true})){
  const file=join(path,item.name);
  if(item.isDirectory()){scan(file);continue;}
  const location=relative(projectRoot,file);
  if(/^\.env(?:\.|$)/.test(item.name)||/\.(?:pem|p12|pfx|key)$/i.test(item.name))findings.add(location);
  const data=readFileSync(file);
  if(secrets.some(secret=>data.includes(Buffer.from(secret))||data.includes(Buffer.from(encodeURIComponent(secret)))))findings.add(location);
  if(/AIza[0-9A-Za-z_-]{35}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(data.toString()))findings.add(location);
 }
}
const directory=join(projectRoot,process.argv.includes('--dist')?'dist':'public');
try{if(statSync(directory).isDirectory())scan(directory);}catch(error){if(error.code!=='ENOENT')throw error;}
if(findings.size){console.error('Secrets must not be public. Review these locations:\n'+[...findings].join('\n'));process.exit(1);}
console.log(`Public-secret check passed (${relative(projectRoot,directory)}).`);
