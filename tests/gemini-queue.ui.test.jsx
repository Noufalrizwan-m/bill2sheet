import {test,expect,vi} from 'vitest';
import {waitFor} from '@testing-library/react';
import 'fake-indexeddb/auto';
vi.mock('../src/queue-delay.js',()=>({waitBetweenPhotos:vi.fn(async()=>{})}));
vi.mock('../src/image.js',()=>({compressImage:async()=> 'data:image/jpeg;base64,/9j/4AAQ/9k='}));
import {uploadPhoto,getRegister,retryBill,stopProcessing,resumeProcessing} from '../src/api.js';
import {getRecord,listRecords,removeRecord} from '../src/register.js';
import {mapGeminiVoucher} from '../shared/gemini.js';
test('Gemini quota pauses queued photos; explicit resume fills each saved row without duplicates',async()=>{
 URL.createObjectURL=()=> 'blob:test';
 const fetch=vi.fn(async()=>({ok:false,json:async()=>({error:'Quota reached',pauseQueue:true})}));vi.stubGlobal('fetch',fetch);
 try{
  await uploadPhoto({id:'gemini-first',file:new Blob(['photo']),name:'first.jpg',reader:'gemini'});
  await uploadPhoto({id:'gemini-next',file:new Blob(['photo']),name:'next.jpg',reader:'gemini'});
  await waitFor(async()=>expect((await getRecord('gemini-first')).status).toBe('paused'));
  await getRegister();expect(fetch).toHaveBeenCalledTimes(1);expect((await getRecord('gemini-next')).status).toBe('queued');
  fetch.mockImplementation(async(_url,options)=>({ok:true,json:async()=>JSON.parse(options.body).images.map(()=>({voucher_date:'27-06-2026',paid_to:'Gas Both Camp',particulars:null,row_amounts:[1725],total:1725,unclear:[]}))}));
  await retryBill('gemini-first','gemini');
  await waitFor(async()=>expect((await getRecord('gemini-next')).status).toBe('saved'),{timeout:8000});
  const rows=await listRecords();expect(rows).toHaveLength(2);expect(rows.every(b=>b.total===1725&&b.vendor==='Gas Both Camp')).toBe(true);
  await uploadPhoto({id:'gemini-first',file:new Blob(['retry']),reader:'gemini'});expect(await listRecords()).toHaveLength(2);
 }finally{for(const b of await listRecords())await removeRecord(b.id);vi.unstubAllGlobals();}
});
test('all-null reading stays a failed photo, never a saved voucher',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[{voucher_date:null,paid_to:null,particulars:null,row_amounts:[],total:null,unclear:[{field:'total',note:'Unreadable'}]}]})));
 try{
 await uploadPhoto({id:'blank-photo',file:new Blob(['photo']),name:'blank.jpg'});
 await waitFor(async()=>expect((await getRecord('blank-photo')).status).toBe('error'));
 const row=await getRecord('blank-photo');expect(row.recordType).toBe('photo');expect(row.error).toContain('No readable voucher data');
 }finally{for(const b of await listRecords())await removeRecord(b.id);vi.unstubAllGlobals();}
});

test('stop aborts active request, retains photos and prevents polling from restarting until resume',async()=>{
 localStorage.clear();
 let signal;
 const request=vi.fn((_url,options)=>{signal=options.signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));});
 vi.stubGlobal('fetch',request);
 try{
  await uploadPhoto({id:'stop-first',file:new Blob(['one']),name:'one.jpg'});
  await waitFor(()=>expect(request).toHaveBeenCalledOnce());
  await uploadPhoto({id:'stop-second',file:new Blob(['two']),name:'two.jpg'});
  await stopProcessing();
  await waitFor(async()=>expect((await getRecord('stop-first')).status).toBe('queued'));
  expect(signal.aborted).toBe(true);
  expect((await getRegister()).processingStopped).toBe(true);
  expect(await listRecords()).toHaveLength(2);
  expect(request).toHaveBeenCalledOnce();
  await removeRecord('stop-second');
  request.mockImplementation(async()=>({ok:true,json:async()=>[{voucher_date:null,paid_to:'Test',particulars:null,row_amounts:[10],total:10,unclear:[]}]}));
  await resumeProcessing();
  await waitFor(async()=>expect((await getRecord('stop-first')).status).toBe('saved'),{timeout:8000});
  expect((await getRecord('stop-first')).total).toBe(10);
  expect(await listRecords()).toHaveLength(1);
 }finally{for(const b of await listRecords())await removeRecord(b.id);localStorage.clear();vi.unstubAllGlobals();}
});

test('queued photos are sent together and mapped to their own rows',async()=>{
 const {uploadPhotos}=await import('../src/api.js');
 const fetch=vi.fn(async(_url,options)=>({ok:true,json:async()=>JSON.parse(options.body).images.map((_,i)=>({voucher_date:null,paid_to:`Vendor ${i+1}`,particulars:null,row_amounts:[],total:i+1,unclear:[]}))}));
 vi.stubGlobal('fetch',fetch);
 try{
  await uploadPhotos([{id:'batch-one',file:new Blob(['one'])},{id:'batch-two',file:new Blob(['two'])}]);
  await waitFor(async()=>expect((await getRecord('batch-two')).status).toBe('saved'));
  expect(fetch).toHaveBeenCalledOnce();expect(JSON.parse(fetch.mock.calls[0][1].body).images).toHaveLength(2);
  expect((await getRecord('batch-one')).vendor).toBe('Vendor 1');expect((await getRecord('batch-two')).vendor).toBe('Vendor 2');
 }finally{for(const b of await listRecords())await removeRecord(b.id);vi.unstubAllGlobals();}
});

test('stopping one photo in a running batch keeps its manual edit while the other finishes',async()=>{
 const {uploadPhotos,stopPhoto,updateBill}=await import('../src/api.js');
 let finish;
 const fetch=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
 try{
  await uploadPhotos([{id:'individual-one',file:new Blob(['one'])},{id:'individual-two',file:new Blob(['two'])}]);
  await waitFor(()=>expect(fetch).toHaveBeenCalledOnce());
  await stopPhoto('individual-one');
  const stopped=await getRecord('individual-one');expect(stopped.status).toBe('stopped');
  await updateBill('individual-one',{...stopped,vendor:'My edit',total:8});
  finish({ok:true,json:async()=>[{voucher_date:null,paid_to:'Old result',particulars:null,row_amounts:[],total:10,unclear:[]},{voucher_date:null,paid_to:'Other result',particulars:null,row_amounts:[],total:20,unclear:[]}]});
  await waitFor(async()=>expect((await getRecord('individual-two')).status).toBe('saved'));
  expect((await getRecord('individual-one')).vendor).toBe('My edit');
  expect((await getRecord('individual-two')).vendor).toBe('Other result');
 }finally{for(const b of await listRecords())await removeRecord(b.id);vi.unstubAllGlobals();}
});
