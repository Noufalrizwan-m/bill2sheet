import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createStore } from './store.js';
import { readVoucher } from '../shared/voucher.js';
import { isBill } from '../shared/bill.js';
const run=promisify(execFile);
const fields=['bill_no','date','vendor','gst_no','subtotal','gst_amount','total','items','particulars','payment_method','debit_account','credit_account','amount_words','notes'];
async function body(req,limit){let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;if(length>limit)throw Object.assign(new Error('Photo is too large. Maximum size is 35 MB.'),{status:413});chunks.push(chunk);}return Buffer.concat(chunks);}
export async function createService(root,{directory=resolve(root,'.bill2sheet-data'),recognize}={}) {
  const store=await createStore(directory), binary=resolve(root,'.runtime/vision-reader');
  const available=recognize?true:process.platform==='darwin'&&await access(binary).then(()=>true,()=>false);
  const reader=recognize || (async record=>{const {stdout}=await run(binary,[store.photoPath(record.id),store.previewPath(record.id)],{timeout:90000,maxBuffer:4_000_000});return readVoucher(JSON.parse(stdout));});
  let working=false,stopped=false;
  async function drain(){
    if(working||stopped)return;working=true;
    try{for(let record;!stopped&&(record=store.list().find(b=>b.status==='queued'));){
      await store.patch(record.id,{status:'reading',error:null});
      try{if(!available)throw new Error('Mac reader is unavailable. The photo and blank row are saved; you can enter the details.');
        const bill=await reader(record);if(stopped)break;
        await store.patch(record.id,{...bill,status:'saved',reviewed:false,error:null});
      }catch(error){if(stopped)break;await store.patch(record.id,{status:'error',error:available?'Reading did not finish. Your photo and row are saved. Retry or enter the details.':error.message});}
    }}finally{working=false;}
  }
  await store.recover();await store.ensureWorkbook();void drain();
  async function middleware(req,res,next){
    const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/'))return next();
    res.setHeader('Cache-Control','no-store');
    const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    try{
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Open Bill2Sheet directly to upload a photo.'});
      if(url.pathname==='/api/register'&&req.method==='GET')return send(200,{bills:store.list(),readerAvailable:available,savedOn:'This Mac'});
      if(url.pathname==='/api/export/excel'&&req.method==='GET'){res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition','attachment; filename="Bill2Sheet.xlsx"');return res.end(await readFile(store.workbook));}
      if(url.pathname==='/api/import-legacy'&&req.method==='POST'){const bills=JSON.parse((await body(req,3_000_000)).toString());if(!Array.isArray(bills)||bills.some(b=>!isBill(b)||typeof b.id!=='string'))return send(400,{error:'Previous records could not be imported.'});await store.importLegacy(bills);return send(200,{ok:true});}
      if(url.pathname==='/api/bills'&&req.method==='POST'){
        const id=String(req.headers['x-bill-id']||'');if(!/^[A-Za-z0-9-]{8,90}$/.test(id))return send(400,{error:'Invalid photo identifier.'});
        const existing=store.get(id);if(existing)return send(200,{bill:existing});
        const buffer=await body(req,35_000_000);if(!buffer.length)return send(400,{error:'The camera returned an empty photo. Please retake it.'});
        let filename='Camera photo';try{filename=decodeURIComponent(String(req.headers['x-file-name']||'Camera photo')).slice(0,240);}catch{}
        const bill=await store.add(id,buffer,filename,String(req.headers['x-image-type']||'image/jpeg'));
        send(201,{bill});void drain();return;
      }
      const match=url.pathname.match(/^\/api\/bills\/([A-Za-z0-9-]{8,90})(?:\/(photo|retry))?$/);
      if(match){const [,id,action]=match,record=store.get(id);if(!record)return send(404,{error:'This voucher was not found.'});
        if(action==='photo'&&req.method==='GET'){try{const bytes=await readFile(store.previewPath(id));res.setHeader('Content-Type','image/jpeg');return res.end(bytes);}catch{const bytes=await readFile(store.photoPath(id));res.setHeader('Content-Type',/^image\/[a-z0-9.+-]+$/i.test(record.type)?record.type:'application/octet-stream');return res.end(bytes);}}
        if(action==='retry'&&req.method==='POST'){if(record.status!=='reading'){await store.patch(id,{status:'queued',error:null});void drain();}return send(200,{ok:true});}
        if(!action&&req.method==='PATCH'){if(['queued','reading'].includes(record.status))return send(409,{error:'Please wait for reading to finish before editing.'});const input=JSON.parse((await body(req,1_000_000)).toString());const changes=Object.fromEntries(fields.filter(k=>k in input).map(k=>[k,input[k]]));if(!isBill({...record,...changes})||['particulars','payment_method','debit_account','credit_account','amount_words','notes'].some(k=>k in changes&&changes[k]!==null&&typeof changes[k]!=='string'))return send(400,{error:'Use numbers for amounts. Every field may be blank.'});return send(200,{bill:await store.patch(id,{...changes,status:'saved',reviewed:true,error:null})});}
        if(!action&&req.method==='DELETE'){if(['queued','reading'].includes(record.status))return send(409,{error:'Wait for reading to finish before deleting.'});await store.remove(id);return send(200,{ok:true});}
      }
      return send(404,{error:'This action is unavailable.'});
    }catch(error){return send(error.status||500,{error:error.status?error.message:'Could not save or read this record. Your existing register has been kept.'});}
  }
  return {middleware,store,stop:()=>{stopped=true;},drain};
}
