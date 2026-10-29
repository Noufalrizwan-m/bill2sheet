import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadLocalGeminiEnv} from '../server/local-env.js';
import {createGeminiHandler} from './helpers/local-reader.js';

test('local server loads explicit project file, ignores empty shell overrides, reloads edits',()=>{
 const root=mkdtempSync(join(tmpdir(),'bill2sheet-env-'));
 try{
  writeFileSync(join(root,'.env.local'),'GEMINI_API_KEY=fixture-secret\nGEMINI_MODEL=fixture-model\n');
  const env=loadLocalGeminiEnv({root,inherited:{GEMINI_API_KEY:'',GEMINI_MODEL:'stale-shell-model'}});
  assert.deepEqual(env,{GEMINI_API_KEY:'fixture-secret',GEMINI_MODEL:'fixture-model',GEMINI_FALLBACK_MODEL:'',VOUCHERQUILL_ACCESS_PASSWORD:'',VOUCHERQUILL_SESSION_SECRET:''});
  writeFileSync(join(root,'.env.local'),'GEMINI_API_KEY=replaced-fixture\nGEMINI_MODEL=fixture-model\n');
  assert.equal(loadLocalGeminiEnv({root,inherited:{}}).GEMINI_API_KEY,'replaced-fixture');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('missing file uses server environment; whitespace settings count as missing',()=>{
 const root=mkdtempSync(join(tmpdir(),'bill2sheet-env-'));
 try{assert.deepEqual(loadLocalGeminiEnv({root,inherited:{GEMINI_API_KEY:'  ',GEMINI_MODEL:'configured-model'}}),{GEMINI_API_KEY:'',GEMINI_MODEL:'configured-model',GEMINI_FALLBACK_MODEL:'',VOUCHERQUILL_ACCESS_PASSWORD:'',VOUCHERQUILL_SESSION_SECRET:''});}
 finally{rmSync(root,{recursive:true,force:true});}
});
test('configuration endpoint and 503 expose variable names and booleans only',async()=>{
 for(const env of [{},{GEMINI_API_KEY:'fixture-secret'},{GEMINI_MODEL:'fixture-model'},{GEMINI_API_KEY:'fixture-secret',GEMINI_MODEL:'fixture-model',GEMINI_FALLBACK_MODEL:'',VOUCHERQUILL_ACCESS_PASSWORD:'',VOUCHERQUILL_SESSION_SECRET:''}]){
  const response=()=>({setHeader(){},end(text){this.raw=text;this.data=JSON.parse(text);}});
  const handler=createGeminiHandler({env,request:()=>{throw Error('No provider call expected');}});
  const status=response();await handler({method:'GET',headers:{}},status);
  assert.equal(status.data.variables.GEMINI_API_KEY,Boolean(env.GEMINI_API_KEY));
  assert.equal(status.data.variables.GEMINI_MODEL,Boolean(env.GEMINI_MODEL));
  assert.ok(!status.raw.includes('fixture-secret'));
  if(!status.data.configured){const error=response();await handler({method:'POST',headers:{},body:{}},error);assert.equal(error.statusCode,503);for(const name of status.data.missing)assert.ok(error.data.error.includes(name));assert.ok(!error.raw.includes('fixture-secret'));}
 }
});
