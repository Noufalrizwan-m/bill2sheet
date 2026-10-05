# Retry update — complete changed files

Private .env.local was not changed and is excluded.

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/api/read-voucher.js
````js
import {setTimeout as delay} from 'node:timers/promises';
import {PROMPT,mapGeminiVoucher} from '../shared/gemini.js';
export const config={maxDuration:240};
const limit=2_600_000;
function respond(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
async function body(req){
 if(req.body!==undefined){const source=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(source)>limit)throw new Error('size');return typeof req.body==='string'?JSON.parse(source):req.body;}
 let size=0;const chunks=[];for await(const part of req){const bytes=Buffer.isBuffer(part)?part:Buffer.from(part);size+=bytes.length;if(size>limit)throw new Error('size');chunks.push(bytes);}return JSON.parse(Buffer.concat(chunks).toString());
}
export function createGeminiHandler({env=process.env,request=fetch,wait=delay,random=Math.random,log=console.info}={}){
 return async(req,res)=>{
  const model=env.GEMINI_MODEL?.trim();
  const missing=['GEMINI_API_KEY','GEMINI_MODEL'].filter(name=>!env[name]?.trim());
  if(req.method==='GET')return respond(res,200,{configured:missing.length===0,variables:{GEMINI_API_KEY:!missing.includes('GEMINI_API_KEY'),GEMINI_MODEL:!missing.includes('GEMINI_MODEL')},missing,model,provider:'Gemini'});
  if(req.method!=='POST')return respond(res,405,{error:'Method not allowed.'});
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return respond(res,403,{error:'Use Bill2Sheet to read a photo.'});}catch{return respond(res,403,{error:'Invalid origin.'});}}
  if(missing.length)return respond(res,503,{error:`${missing.join(' and ')} ${missing.length===1?'is':'are'} missing on the server. Locally, check .env.local in the running project. On Vercel, add the variables for this deployment environment and redeploy.`,status:503,missing,pauseQueue:true});
  let image;
  try{const input=await body(req);image=input?.image;if(typeof image!=='string')throw new Error('image');image=image.replace(/^data:image\/jpeg;base64,/,'');if(!image||image.length>2_500_000||image.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(image))throw new Error('image');const bytes=Buffer.from(image,'base64');if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error('image');}
  catch{return respond(res,400,{error:'Invalid photo. Upload a JPEG or use the camera/HEIC conversion in Bill2Sheet.'});}
  const controller=new AbortController();
  const closed=()=>{if(!res.writableEnded)controller.abort();};
  res.on?.('close',closed);
  try{
   const fallback=env.GEMINI_FALLBACK_MODEL?.trim();
   let response;
   for(let attempt=1;attempt<=7;attempt++){
    const selected=fallback&&attempt%2===0?fallback:model;
    response=await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selected)}:generateContent`,{
     method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),
     body:JSON.stringify({systemInstruction:{parts:[{text:PROMPT}]},contents:[{role:'user',parts:[{inlineData:{mimeType:'image/jpeg',data:image}},{text:'Read the foreground voucher.'}]}],generationConfig:{responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'low'},temperature:0,maxOutputTokens:2000}})
    });
    log({status:response.status,model:selected,attempt});
    if(response.ok)break;
    const raw=await response.text();
    let detail;try{detail=JSON.parse(raw).error;}catch{}
    const message=String(detail?.message||raw||response.statusText||'Gemini request failed').split(env.GEMINI_API_KEY).join('[redacted]');
    if([503,429].includes(response.status)){
     if(attempt<7){await wait(Math.min(2000*2**(attempt-1),20000)+Math.floor(random()*500),undefined,{signal:controller.signal});continue;}
     return respond(res,response.status,{error:`Gemini is busy or its quota is unavailable after 7 attempts. Photo saved in Retry failed. Try again later. ${message}`,status:response.status,providerStatus:detail?.status||null,retryable:true,pauseQueue:false});
    }
    return respond(res,response.status,{error:message,status:response.status,providerStatus:detail?.status||null,pauseQueue:[401,403,404].includes(response.status)});
   }
   const data=await response.json(),candidate=data.candidates?.[0];
   if(data.promptFeedback?.blockReason||candidate?.finishReason!=='STOP')return respond(res,422,{error:'Gemini did not return a complete reading. Crop the voucher and retry.'});
   const text=(candidate.content?.parts||[]).map(p=>p.text||'').join('').trim();
   let result;try{result=mapGeminiVoucher(JSON.parse(text));}catch{return respond(res,422,{error:'Gemini returned invalid voucher data. The photo is saved; retry or enter the values manually.'});}
   return respond(res,200,JSON.parse(result.text));
  }catch{if(!controller.signal.aborted)return respond(res,502,{error:'Gemini could not be reached or timed out. Photo saved in Retry failed.',retryable:true,pauseQueue:false});}finally{res.off?.('close',closed);}
 };
}
export default createGeminiHandler();

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/server/local-env.js
````js
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {parseEnv} from 'node:util';

export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const names=['GEMINI_API_KEY','GEMINI_MODEL','GEMINI_FALLBACK_MODEL'];

// Local tooling only: never imported by the browser or the deployed function.
// A nonempty .env.local value wins over an inherited shell value locally.
export function loadLocalGeminiEnv({root=projectRoot,inherited=process.env}={}){
 let local={};
 try{local=parseEnv(readFileSync(join(root,'.env.local'),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw new Error('Cannot read .env.local in the project root.');}
 return Object.fromEntries(names.map(name=>[name,local[name]?.trim()||inherited[name]?.trim()||'']));
}

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/.env.example
````example
# Server only. Never use a VITE_ prefix.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash

# Optional. Leave blank to retry only GEMINI_MODEL.
GEMINI_FALLBACK_MODEL=

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/src/api.js
````js
import { listRecords, getRecord, addRecord, patchRecord, removeRecord, importRecords } from './register.js';
import {waitBetweenPhotos} from './queue-delay.js';
import { compressImage } from './image.js';
import {mapGeminiVoucher} from '../shared/gemini.js';
import {recoverVoucherDate} from '../shared/date-recovery.js';
import {hasVoucherData} from '../shared/voucher.js';
const urls = new Map();
let running = false;
let activeController=null;
const pauseKey='bill2sheet-processing-paused';
const isStopped=()=>localStorage.getItem(pauseKey)==='yes';
function cancellable(task,signal){
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(new DOMException('Processing stopped','AbortError'));
  if(signal.aborted){abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve(task).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
export async function stopProcessing(){
 localStorage.setItem(pauseKey,'yes');
 activeController?.abort();
}
export async function resumeProcessing(){
 localStorage.removeItem(pauseKey);
 void drain().catch(console.error);
}
async function drain() {
  if (running || isStopped()) return;
  running = true;
  try {
    for (;;) {
      const records=await listRecords();
      if(isStopped())break;
      const paused=records.some(b=>b.status==='paused');
      const entry=records.find(b=>b.status==='queued'&&!paused); 
      if (!entry) break;
      const controller=new AbortController(); activeController=controller;
      await patchRecord(entry.id, { status: 'reading', reading_progress:'Preparing photo…' });
      try {
        if(controller.signal.aborted)throw new DOMException('Processing stopped','AbortError');
        if (!entry.original) throw new Error('Original photo unavailable. Enter the details manually.');
        const image = entry.preparedImage || await cancellable(compressImage(entry.original),controller.signal);
        if(controller.signal.aborted)throw new DOMException('Processing stopped','AbortError');
        await patchRecord(entry.id, { preview: image, reading_progress:'Waiting for Gemini to read the voucher…' });
        let response;
        try{response=await fetch('/api/read-voucher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(240000)])});}
        catch{throw Object.assign(new Error('Gemini connection interrupted. Photo saved; retry when online.'),{pauseQueue:true});}
        let data;try{data=await response.json();}catch{throw Object.assign(new Error(`Server HTTP ${response.status}: invalid JSON response. Retry when the server is available.`),{pauseQueue:true});}
        if(!response.ok)throw Object.assign(new Error(`Gemini ${data.status||response.status}: ${data.error||'Reading failed'}`),{pauseQueue:data.pauseQueue});
        if(controller.signal.aborted)throw new DOMException('Processing stopped','AbortError');
        const result=mapGeminiVoucher(data);
        if(!hasVoucherData(result.bill))throw new Error(`No readable voucher data. ${(data.unclear||[]).map(u=>u.note).join(' ')} Crop the top voucher and retry, or enter the details manually.`);
        await patchRecord(entry.id, { ...result.bill, recordType:'voucher', raw_text: result.text, status: 'saved', error:null, reviewed: false,
          recognition_note: result.bill.recognition_note || 'Gemini reading: check handwritten values against the photo.' });
      } catch (error) {
        if(controller.signal.aborted){await patchRecord(entry.id,{status:'queued',reading_progress:null,error:null});break;}
        await patchRecord(entry.id, { status: error.pauseQueue?'paused':'error', error: error.message });
      }
      if(!isStopped())await waitBetweenPhotos();
    }
  } finally { activeController=null; running = false; }
}
let recovered = false;
export async function getRegister() {
  if (!recovered) {
    recovered = true;
    for (const bill of await listRecords()) if (bill.status === 'reading') await patchRecord(bill.id, { status: 'queued' });
  }
  const bills = await listRecords();
  for (const bill of bills) {
    const recoveredDate=recoverVoucherDate(bill);
    if(recoveredDate){await patchRecord(bill.id,recoveredDate);Object.assign(bill,recoveredDate);}
    if (bill.preview) bill.photoUrl = bill.preview;
    else if (bill.original) {
      if (!urls.has(bill.id)) urls.set(bill.id, URL.createObjectURL(bill.original));
      bill.photoUrl = urls.get(bill.id);
    }
  }
  void drain().catch(console.error);
  return { bills, readerAvailable: true, processingStopped:isStopped() };
}
export async function uploadPhoto(entry) { const record = await addRecord(entry); void drain().catch(console.error); return record; }
export async function updateBill(id, bill) {
  const { original, preview, photoUrl, ...fields } = bill;
  return patchRecord(id, { ...fields, recordType:hasVoucherData(fields)?'voucher':'photo', status:hasVoucherData(fields)?'saved':'error', error:hasVoucherData(fields)?null:'No voucher data entered. Photo kept for retry.', reviewed:true });
}
export async function deleteBill(id) { await removeRecord(id); if (urls.has(id)) URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
export async function retryBill(id, reader = 'gemini') { if (await getRecord(id)) await patchRecord(id, { status: 'queued', error: null, reader }); void drain().catch(console.error); }
export const importLegacy = importRecords;

export async function cropAndRetry(id, image, reader) { await patchRecord(id, {preparedImage:image,preview:image,status:'queued',reader,error:null}); void drain().catch(console.error); }

export async function getGeminiStatus(){try{const response=await fetch('/api/read-voucher');if(!response.ok)return {configured:false};return await response.json();}catch{return {configured:false};}}

export async function retryFailed(){
 for(const bill of await listRecords())if(['error','paused'].includes(bill.status))await patchRecord(bill.id,{status:'queued',error:null,reading_progress:null});
 await resumeProcessing();
}

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/src/App.jsx
````jsx
import ExportReview from './ExportReview.jsx';
import {exportReview,hasNumericAmounts} from '../shared/export-review.js';
import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, FileSpreadsheet, Download, ReceiptText, ShieldCheck, LoaderCircle, Pencil, Trash2, X, Search, Check, CircleAlert, RotateCcw } from 'lucide-react';
import { grandTotal, money } from '../shared/bill.js';
import { voucherWarnings,hasVoucherData } from '../shared/voucher.js';
import { downloadVoucherPDF, downloadVoucherExcel } from '../shared/voucher-export.js';
import { createId, isImage } from './uploads.js';
import { listOutbox, queuePhotos, removeOutbox } from './outbox.js';
import { getRegister, uploadPhoto, updateBill, deleteBill, retryBill, importLegacy, cropAndRetry, getGeminiStatus, stopProcessing, resumeProcessing, retryFailed } from './api.js';
import Cropper from './Cropper.jsx';
import { loadBills } from './storage.js';

const labels={date:'Date',vendor:'Paid to / Vendor',particulars:'Particulars',total:'Amount',bill_no:'Voucher / Bill number',payment_method:'Cash / Cheque',debit_account:'DR A/c number',credit_account:'CR A/c number',amount_words:'Amount in words',source_date:'Date as written',amount_text:'Amount as written',notes:'Notes'};
const isReading=b=>['queued','reading'].includes(b.status);
function Editor({bill,onClose,onSaved,reader}) {
  const [draft,setDraft]=useState(bill),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [cropping,setCropping]=useState(false);
  const warnings=voucherWarnings(draft);
  async function save(event){event.preventDefault();setBusy(true);try{await updateBill(bill.id,draft);onSaved();}catch(error){setError(error.message);}finally{setBusy(false);}}
  return <section className="panel voucher-editor" aria-label="Edit voucher"><div className="panel-heading"><div><span className="eyebrow">SAVED VOUCHER</span><h2>Check or edit the details</h2></div><button className="icon-button" aria-label="Close editor" onClick={onClose}><X/></button></div><div className="review-grid"><div className="bill-preview"><a href={bill.photoUrl} target="_blank" rel="noreferrer"><img src={bill.photoUrl} alt="Original voucher" onError={event=>{event.currentTarget.style.display='none';}}/></a><button type="button" className="button secondary" disabled={!bill.photoUrl} onClick={()=>setCropping(!cropping)}>Crop / rotate photo</button>{cropping&&<Cropper source={bill.photoUrl} onClose={()=>setCropping(false)} onApply={async image=>{await cropAndRetry(bill.id,image,reader);onSaved();}}/>}<span className="photo-caption">{bill.filename || 'Previous record'} · Tap to enlarge</span></div><form onSubmit={save} noValidate><p className="form-note">All fields are optional. Dates use DD-MM-YYYY; a two-digit year such as 26 means 2026. Blank values stay blank in Excel.</p>{bill.recognition_note&&<p className="review-note">{bill.recognition_note}</p>}{bill.source_date&&<p className="form-note">Date written on the voucher: {bill.source_date}</p>}<details><summary>Recognized text — compare with photo</summary><pre className="raw-text">{bill.raw_text||"No readable text available."}</pre></details><div className="fields-grid">{Object.entries(labels).map(([key,label])=><label className={`field ${['particulars','amount_words','notes'].includes(key)?'full-field':''}`} key={key}><span>{label}</span><input aria-label={label} value={draft[key]??''} placeholder={key==='date'?'DD-MM-YYYY':'Optional'} type={key==='total'?'number':'text'} inputMode={key==='total'?'decimal':undefined} step={key==='total'?'any':undefined} onChange={e=>setDraft({...draft,[key]:e.target.value===''?null:key==='total'?(Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:null):e.target.value})}/></label>)}</div><fieldset><legend>Row amounts</legend>{(draft.items||[]).map((item,index)=><label className="field" key={index}><span>Row {index+1}</span><input aria-label={`Row ${index+1} amount`} type="number" step="any" value={item.amount??''} onChange={event=>setDraft({...draft,items:draft.items.map((old,i)=>i===index?{...old,amount:event.target.value===''?null:event.target.valueAsNumber}:old)})}/></label>)}<button type="button" className="button secondary" onClick={()=>setDraft({...draft,items:[...(draft.items||[]),{name:null,qty:null,rate:null,amount:null}]})}>Add row amount</button></fieldset>{draft.unclear?.length>0&&<label className="form-note"><input type="checkbox" onChange={event=>setDraft({...draft,unclear:event.target.checked?[]:bill.unclear,uncertain_fields:event.target.checked?[]:bill.uncertain_fields})}/> I checked and resolved the unclear fields against the photo.</label>}{warnings.length>0&&<div className="validation">{warnings.join(' ')} You can still save.</div>}{error&&<p className="validation" role="alert">{error}</p>}<div className="form-actions editor-actions"><button type="button" className="button secondary" onClick={onClose}>Close</button><button className="button primary" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:<Check size={18}/>}Save changes</button></div></form></div></section>;
}
function ConfirmDelete({onClose,onDelete}){const ref=useRef(null);useEffect(()=>{ref.current.showModal();return()=>ref.current?.close();},[]);return <dialog ref={ref} className="delete-modal panel" onCancel={onClose}><h2>Delete this voucher?</h2><p>It will be removed from your saved register and Excel file.</p><div className="form-actions"><button className="button secondary" autoFocus onClick={onClose}>Keep voucher</button><button className="button danger" onClick={onDelete}>Delete</button></div></dialog>;}
export default function App(){
  const [processingStopped,setProcessingStopped]=useState(false);
  const [requestedExport,setRequestedExport]=useState(null);
  const reader='gemini'; const [geminiStatus,setGeminiStatus]=useState(null);
  const [bills,setBills]=useState([]),[connected,setConnected]=useState(false),[readerAvailable,setReaderAvailable]=useState(true);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[captureStatus,setCaptureStatus]=useState('');
  const [outboxCount,setOutboxCount]=useState(0),[uploading,setUploading]=useState(false),[loading,setLoading]=useState(true),[savingPhotos,setSavingPhotos]=useState(false);
  const [query,setQuery]=useState(''),[editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null),[exporting,setExporting]=useState(false);
  const busy=useRef(false),alive=useRef(true),selection=useRef(''),picker=useRef(null),waiting=useRef(false),table=useRef(null);
  const receiveFilesRef=useRef(null);
  async function refresh(){try{const data=await getRegister();if(alive.current){setBills(data.bills);setProcessingStopped(Boolean(data.processingStopped));setReaderAvailable(data.readerAvailable);setConnected(true);}}catch{if(alive.current)setConnected(false);}finally{if(alive.current)setLoading(false);}}
  async function sendWaiting(){
    if(busy.current)return;busy.current=true;setUploading(true);
    try{let pending=await listOutbox();setOutboxCount(pending.length);while(pending.length){const entry=pending[0];if(!alive.current)break;await uploadPhoto(entry);await removeOutbox(entry.id);setOutboxCount(count=>Math.max(0,count-1));await refresh();pending=await listOutbox();}if(!pending.length)setNotice('Photos saved on this device. Keep this page open while reading; unfinished photos resume when you return.');}
    catch(error){setError(`Upload paused. Your selected photos remain on this device. ${error.message}`);}
    finally{busy.current=false;if(alive.current)setUploading(false);}
  }
  useEffect(()=>{
    alive.current=true;let timer;void getGeminiStatus().then(setGeminiStatus);
    (async()=>{await refresh();try{const previous=loadBills();if(previous.error)throw new Error(previous.error);if(!localStorage.getItem('bill2sheet-device-migrated')&&previous.bills.length){await importLegacy(previous.bills);localStorage.setItem('bill2sheet-device-migrated','yes');await refresh();}}catch{/* Keep the old browser register intact if migration cannot reach the Mac. */}if(alive.current)await sendWaiting();})();
    timer=setInterval(()=>{if(alive.current)void refresh();},2000);
    const online=()=>{void refresh();void sendWaiting();};window.addEventListener('online',online);
    return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('online',online);};
  },[]);
  useEffect(()=>{
    let timer;const resume=()=>{if(!waiting.current||document.visibilityState!=='visible')return;clearTimeout(timer);timer=setTimeout(()=>{if(!waiting.current)return;if(picker.current?.files?.length)receiveFilesRef.current(picker.current);else setCaptureStatus('No photo returned yet. Tap Use Photo in the camera, or choose Upload from Photos.');},1500);};
    window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    return()=>{clearTimeout(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
  },[]);
  function begin(event){event.currentTarget.value='';picker.current=event.currentTarget;waiting.current=true;selection.current='';setCaptureStatus('Take the picture, then tap Use Photo.');}
  async function receiveFiles(input){
    const files=Array.from(input.files||[]);if(!files.length){setCaptureStatus('No photo returned. Try Upload from Photos.');return;}
    const fingerprint=files.map(f=>`${f.name}:${f.size}:${f.lastModified}`).join('|');if(fingerprint===selection.current)return;selection.current=fingerprint;waiting.current=false;setError('');setSavingPhotos(true);
    try{const invalid=files.find(f=>!isImage(f)||!f.size||f.size>35_000_000);if(invalid)throw new Error('Choose image files up to 35 MB each. No fields are required.');
      const entries=files.map(file=>({id:createId(),file,name:file.name,createdAt:Date.now(),reader}));
      await queuePhotos(entries);setOutboxCount((await listOutbox()).length);setCaptureStatus(`${files.length} photo${files.length===1?'':'s'} received and saved on this device.`);
      table.current?.scrollIntoView({behavior:'smooth',block:'start'});void sendWaiting();
    }catch(error){selection.current='';setError(error.message);}finally{setSavingPhotos(false);}
  }
  receiveFilesRef.current=receiveFiles;
  async function remove(){try{await deleteBill(deleting.id);setDeleting(null);await refresh();}catch(error){setError(error.message);}}
  async function retry(id){try{await retryBill(id,reader);await refresh();}catch(error){setError(error.message);}}
  async function runExport(format){setExporting(true);try{if(format==='pdf')await downloadVoucherPDF(bills);else await downloadVoucherExcel(bills);setRequestedExport(null);}catch{setError('Export failed. Please try again.');}finally{setExporting(false);}}
  function requestExport(format){if(exportReview(bills).needed)setRequestedExport(format);else void runExport(format);}
  function reviewBeforeExport(){const bill=bills.find(b=>!isReading(b)&&(!b.reviewed||(!b.vendor&&!b.date&&b.total==null)))||bills.find(b=>!isReading(b));setRequestedExport(null);if(bill)setEditing(bill);else setNotice('Photos are still reading. Wait for them to finish, then open Edit.');}
  const pending=bills.filter(isReading).length, saved=bills.filter(b=>b.status==='saved'&&hasVoucherData(b)).length, failed=bills.filter(b=>['error','paused'].includes(b.status)).length;
  const filtered=bills.filter(b=>[b.date,b.vendor,b.particulars,b.bill_no,b.filename].some(value=>(value||'').toLowerCase().includes(query.toLowerCase())));
  return <div className="app-shell"><header className="topbar"><div className="topbar-inner"><div className="brand"><span className="brand-mark"><ReceiptText size={25}/></span><span>Bill<span className="brand-two">2</span>Sheet</span></div><span className={`connection-state ${connected?'':'offline'}`}><ShieldCheck size={16}/>{connected?'Saved on this device':'Opening saved register…'}</span></div></header><main className="main-wrap voucher-workspace"><div className="page-top"><div><span className="eyebrow">YOUR PAYMENT VOUCHERS</span><h1>One photo. One saved row.</h1><p>Keep adding vouchers. Your register saves automatically. Download an editable Excel file anytime.</p></div></div>
    <section className="panel quick-capture"><div><h2>Add the next voucher</h2><p>Photograph only the voucher in good light. Handwriting needs checking. Every field is optional.</p></div><p className="form-note">Photos are sent to Google Gemini for reading. {geminiStatus?.configured?`Configured model: ${geminiStatus.model}`:'Set GEMINI_API_KEY and GEMINI_MODEL on the server.'} Check every amount against the photo.</p><div className="capture-controls"><label className={`button primary file-control ${savingPhotos?'disabled':''}`}><Camera size={20}/>Take Photo<input aria-label="Take a voucher photo" type="file" accept="image/*" capture="environment" disabled={savingPhotos} onClick={begin} onChange={e=>receiveFiles(e.currentTarget)} onInput={e=>receiveFiles(e.currentTarget)} onCancel={()=>{waiting.current=false;setCaptureStatus('No photo selected. You can try again.');}}/></label><label className={`button secondary file-control ${savingPhotos?'disabled':''}`}><Upload size={19}/>Upload from Photos<input aria-label="Upload voucher photos" type="file" accept="image/*,.heic,.heif" multiple disabled={savingPhotos} onClick={begin} onChange={e=>receiveFiles(e.currentTarget)} onInput={e=>receiveFiles(e.currentTarget)}/></label></div>{captureStatus&&<p className="capture-status" role="status">{captureStatus}</p>}{savingPhotos&&<p role="status">Saving selected photos on this device…</p>}</section>
    {(!connected&&!loading)&&<div className="message error" role="alert"><CircleAlert size={20}/><span>Device storage could not be opened. Allow browser storage and refresh. Your existing records have not been cleared.</span></div>}
    {error&&<div className="message error" role="alert"><CircleAlert size={20}/><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}><X size={18}/></button></div>}
    {notice&&<div className="message" role="status"><Check size={18}/><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={18}/></button></div>}
    {outboxCount>0&&<div className="message" role="status"><LoaderCircle className={uploading?'spin':''} size={19}/><span>{outboxCount} photo{outboxCount===1?'':'s'} waiting to be added. {uploading?'Uploading…':'You can resume uploading.'}</span>{!uploading&&<button className="button secondary small" onClick={()=>{setError('');void sendWaiting();}}>Resume upload</button>}</div>}
    {!readerAvailable&&connected&&<div className="message error"><CircleAlert size={20}/><span>The local reader is unavailable. Uploaded photos and blank rows are still saved; you can enter the values manually.</span></div>}
    {bills.some(b=>b.status==='paused')&&<div className="message error" role="alert"><span>{bills.find(b=>b.status==='paused').error}</span><button className="button secondary" onClick={async()=>{const paused=bills.find(b=>b.status==='paused');await retryBill(paused.id,'gemini');await refresh();}}>Resume Gemini queue</button></div>}<div className="sheet-stats"><div className="stat"><span>Vouchers in your register</span><strong>{bills.filter(hasVoucherData).length}</strong><small>{saved} read successfully · {pending} waiting / reading · {failed} need attention</small></div><div className="stat total-stat"><span>Grand total</span><strong>{hasNumericAmounts(bills)?money(grandTotal(bills)):'No amounts entered'}</strong><small>AED · Numeric amounts only</small></div><div className="stat"><span>Save status</span><strong className="save-status">{connected?'Saved':'Offline'}</strong><small>Rows saved in this browser</small></div></div>
    {pending>0&&<div className="message" role="status"><LoaderCircle className="spin" size={20}/><span>{processingStopped?'Processing stopped. You can edit or delete unwanted photos below.':(bills.find(b=>b.status==='reading')?.reading_progress||'Photos queued for reading.')} {pending} photo{pending===1?'':'s'} remaining.</span><button className="button secondary" onClick={async()=>{try{if(processingStopped)await resumeProcessing();else await stopProcessing();await refresh();}catch(error){setError(error.message);}}}>{processingStopped?'Resume processing':'Stop processing'}</button></div>}
    {failed>0&&<div className="message"><strong>Retry failed ({failed})</strong><button className="button secondary" onClick={async()=>{try{await retryFailed();await refresh();}catch(error){setError(error.message);}}}>Retry failed photos</button></div>}
    {bills.filter(b=>b.status==='error').map(b=><div className="message error" role="alert" key={b.id}><div><strong>{b.filename||'Voucher'} — reading failed</strong><p>{b.error||'No readable details were returned.'}</p><div className="form-actions"><button className="button secondary" onClick={()=>retry(b.id)}>Retry reading</button><button className="button secondary" onClick={()=>setEditing(b)}>View photo / edit</button></div></div></div>)}
    {editing&&<Editor reader={reader} key={editing.id} bill={editing} onClose={()=>setEditing(null)} onSaved={async()=>{setEditing(null);setNotice('Changes saved. Your next Excel download will include them.');await refresh();}}/>}
    <section ref={table} className="sheet panel"><div className="sheet-heading"><div><span className="eyebrow">SAVED REGISTER</span><h2>Your vouchers, date by date</h2></div><div className="export-actions"><button className="button secondary" disabled={!bills.length||exporting} onClick={()=>requestExport('pdf')}><Download size={17}/>Export PDF</button><button className="button primary" disabled={!bills.length||exporting} onClick={()=>requestExport('excel')}><FileSpreadsheet size={18}/>Export Excel</button></div></div><>{requestedExport&&<ExportReview summary={exportReview(bills)} busy={exporting} onReview={reviewBeforeExport} onExport={()=>runExport(requestedExport)} onClose={()=>setRequestedExport(null)}/>}</><div className="search-row"><label className="search-box"><Search size={18}/><input aria-label="Search vouchers" placeholder="Search date, paid to, or particulars…" value={query} onChange={e=>setQuery(e.target.value)}/></label><span className="muted">{filtered.length} of {bills.length} vouchers</span></div>
    {loading?<div className="empty-sheet"><LoaderCircle className="spin"/><p>Opening your saved register…</p></div>:!bills.length?<div className="empty-sheet"><ReceiptText size={32}/><h3>Take or upload your first voucher.</h3><p>It will appear here automatically. No mandatory fields.</p></div>:!filtered.length?<div className="empty-sheet"><p>No vouchers match your search.</p></div>:<div className="table-scroll"><table className="bill-table voucher-table"><thead><tr><th>Photo</th><th>Date</th><th>Paid to</th><th>Particulars</th><th className="number">Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(b=><tr key={b.id} className={voucherWarnings(b).length?"needs-review":""}><td><a href={b.photoUrl} target="_blank" rel="noreferrer"><img className="voucher-thumb" src={b.photoUrl} alt={`Voucher ${b.filename||''}`} onError={e=>{e.currentTarget.style.visibility='hidden';}}/></a></td><td>{b.date||b.source_date||'—'}</td><td><strong>{b.vendor||'—'}</strong><small>{b.bill_no||b.filename}</small></td><td>{b.particulars||'—'}</td><td className="number total-cell">{b.total===null?(b.amount_text||'—'):money(b.total)}</td><td className="review-cell">{isReading(b)?<span className="badge"><LoaderCircle className="spin" size={14}/>{processingStopped?'Stopped':b.status==='queued'?'Queued':(b.reading_progress||'Reading…')}</span>:['error','paused'].includes(b.status)?<><span className="badge warning">{b.status==='paused'?'Reading paused':'Saved · needs entry'}</span><small>{b.error}</small></>:<><span className="badge"><Check size={13}/>{b.reviewed?'Checked':'Photo saved · needs checking'}</span><small>{voucherWarnings(b).join(' | ')||(b.reviewed?'Checked by you':(b.recognition_note||'Check handwriting'))}</small></>}</td><td><div className="row-actions"><button className="icon-button" disabled={isReading(b)&&!processingStopped} aria-label={`Edit ${b.filename||b.id}`} onClick={()=>setEditing(b)}><Pencil size={17}/></button>{!isReading(b)&&<button className="icon-button" aria-label={`Retry ${b.filename||b.id}`} onClick={()=>retry(b.id)}><RotateCcw size={17}/></button>}<button className="icon-button" disabled={isReading(b)&&!processingStopped} aria-label={`Delete ${b.filename||b.id}`} onClick={()=>setDeleting(b)}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table></div>}
    <div className="sheet-footer"><span>Exports skip photos with no readable data. Downloading does not clear your register.</span><span>{pending>0?`${pending} still reading; wait for a complete export.`:'Saved in this browser. Export a backup before clearing browser data.'}</span></div></section><footer className="app-footer"><span>Bill2Sheet · Voucher register 7</span><span>Gemini voucher reader</span></footer></main>{deleting&&<ConfirmDelete onClose={()=>setDeleting(null)} onDelete={remove}/>}</div>;
}

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/src/queue-delay.js
````js
export const waitBetweenPhotos=()=>new Promise(resolve=>setTimeout(resolve,2000+Math.floor(Math.random()*1000)));

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/tests/gemini.test.js
````js
import test from 'node:test';import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createGeminiHandler} from '../api/read-voucher.js';
import {mapGeminiVoucher} from '../shared/gemini.js';
import {createVoucherWorkbook} from '../shared/voucher-export.js';
const GEMINI_MODEL='gemini-3.6-flash';
const voucher={voucher_date:'27-06-2026',paid_to:'Gas Both Camp',particulars:null,row_amounts:[1725],total:1725,unclear:[]};
const image=Buffer.from([255,216,255,224,0,16,255,217]).toString('base64');
const res=()=>({setHeader(){},end(text){this.data=JSON.parse(text);}});
const req=(body={image})=>({method:'POST',headers:{},body});
const success=data=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(data)}]}}]})});
test('Gemini response maps into actual Excel fields and numeric amounts',async()=>{
 let options,url;const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'server-test-key'},request:async(u,o)=>{url=u;options=o;return success(voucher);}});
 const response=res();await handler(req({image:`data:image/jpeg;base64,${image}`}),response);
 assert.equal(response.statusCode,200);assert.equal(response.data.paid_to,'Gas Both Camp');assert.equal(response.data.total,1725);
 const wb=await createVoucherWorkbook([mapGeminiVoucher(response.data).bill]);assert.equal(wb.Sheets.Vouchers.B2.v,'Gas Both Camp');assert.equal(wb.Sheets.Vouchers.D2.v,1725);assert.equal(wb.Sheets.Vouchers.D2.t,'n');
 assert.ok(url.includes(GEMINI_MODEL));assert.equal(options.headers['x-goog-api-key'],'server-test-key');assert.ok(!JSON.stringify(response.data).includes('server-test-key'));
 const input=JSON.parse(options.body);assert.equal(input.contents[0].parts[0].inlineData.data,image);assert.equal(input.generationConfig.responseMimeType,'application/json');assert.equal(input.generationConfig.responseJsonSchema,undefined);assert.equal(input.generationConfig.temperature,0);assert.ok(input.generationConfig.maxOutputTokens>=2000);
});
test('unclear data remains null, unreadable row positions preserved, impossible dates flagged',()=>{
 const {bill}=mapGeminiVoucher({...voucher,voucher_date:'31-02-2026',row_amounts:[null,20],unclear:[{field:'total',note:'3 or 8'}]});
 assert.equal(bill.total,null);assert.equal(bill.date,null);assert.equal(bill.items[0].amount,null);assert.ok(bill.recognition_note.includes('3 or 8'));
 assert.throws(()=>mapGeminiVoucher({...voucher,total:'1,725'}));assert.throws(()=>mapGeminiVoucher({...voucher,paid_to:42}));
});
test('missing key pauses without making a provider call and status reveals no secret',async()=>{
 const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{},request:()=>{throw new Error('unexpected call');}});const response=res();await handler(req(),response);assert.equal(response.statusCode,503);assert.equal(response.data.pauseQueue,true);
 const status=res();await handler({method:'GET',headers:{}},status);assert.equal(status.data.configured,false);
});
test('quota errors exhaust six retries and remain available for manual retry',async()=>{
 let calls=0;const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'test'},request:async()=>{calls++;return {ok:false,status:429,text:async()=>JSON.stringify({error:{message:"Quota reached",status:"RESOURCE_EXHAUSTED"}})};}});const response=res();await handler(req(),response);assert.equal(calls,7);assert.equal(response.statusCode,429);assert.equal(response.data.pauseQueue,false);
});
test('malformed JSON, non-JPEG input, wrong methods and cross-origin requests are rejected',async()=>{
 const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'test'},request:()=>{throw new Error('unexpected call');}});
 for(const request of [req({image:'bad'}),req('{bad json')]){const response=res();await handler(request,response);assert.equal(response.statusCode,400);}
 const wrong=res();await handler({method:'DELETE',headers:{}},wrong);assert.equal(wrong.statusCode,405);
 const origin=res();await handler({...req(),headers:{origin:'https://other.example',host:'app.example'}},origin);assert.equal(origin.statusCode,403);
});
test('Vite raw request body is read and multipart response text is joined',async()=>{
 const request=Readable.from([JSON.stringify({image})]);request.method='POST';request.headers={};
 const text=JSON.stringify(voucher);const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'test'},request:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{thoughtSignature:'signature-only'},{text:'  '+text.slice(0,30),thoughtSignature:'extra-field'},{text:text.slice(30)+'  '}]}}]})})});
 const response=res();await handler(request,response);assert.equal(response.statusCode,200);
});
test('blocked, truncated, invalid and schema-wrong results never succeed as a blank voucher',async()=>{
 for(const data of [{promptFeedback:{blockReason:'OTHER'}},{candidates:[{finishReason:'MAX_TOKENS'}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'not JSON'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]}]){
 const handler=createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_MODEL,GEMINI_API_KEY:'test'},request:async()=>({ok:true,json:async()=>data})});const response=res();await handler(req(),response);assert.equal(response.statusCode,422);
 }
});
test('configured model is used without an allowlist and provider status/message survive',async()=>{
 for(const status of [400,403,404,429,503]){
 let url;const response=res();await createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_API_KEY:'private-test',GEMINI_MODEL:'gemini-future-flash'},request:async u=>{url=u;return {ok:false,status,text:async()=>JSON.stringify({error:{status:'PROVIDER_ERROR',message:'Exact provider message'}})};}})(req(),response);
 assert.ok(url.includes('gemini-future-flash'));assert.equal(response.statusCode,status);assert.equal(response.data.status,status);assert.ok(response.data.error.includes('Exact provider message'));
 }
});
test('missing model fails explicitly without silently choosing one',async()=>{
 const response=res();await createGeminiHandler({wait:async()=>{},log:()=>{},env:{GEMINI_API_KEY:'private'},request:()=>{throw Error('Must not call');}})(req(),response);
 assert.equal(response.statusCode,503);assert.match(response.data.error,/GEMINI_MODEL/);
});
test('export skips blank photos, retains numeric zero, includes review notes and mismatch',async()=>{
 const {voucherWarnings}=await import('../shared/voucher.js');
 const {bill}=mapGeminiVoucher({...voucher,row_amounts:[3800],total:3300});
 assert.equal(bill.total,3300);assert.ok(voucherWarnings(bill).length);
 const workbook=await createVoucherWorkbook([{vendor:null,date:null,total:null,items:[]},bill,{...bill,vendor:'Zero',total:0,items:[]}]);
 const sheet=workbook.Sheets.Vouchers;
 assert.equal(sheet.E1.v,'Review notes');assert.equal(sheet.D2.v,3300);assert.equal(sheet.D3.v,0);assert.equal(sheet.D5.v,3300);assert.match(sheet.E2.v,/do not add up/);
});
test('busy retries alternate configured models with capped exponential jitter and safe logs',async()=>{
 const models=[],waits=[],logs=[];
 const handler=createGeminiHandler({env:{GEMINI_API_KEY:'secret-value',GEMINI_MODEL:'primary',GEMINI_FALLBACK_MODEL:'fallback'},random:()=>0.5,wait:async ms=>waits.push(ms),log:event=>logs.push(event),request:async(url,options)=>{
 models.push(decodeURIComponent(url.split('/models/')[1].split(':')[0]));
 const config=JSON.parse(options.body).generationConfig;
 assert.equal(config.thinkingConfig.thinkingLevel,'low');assert.equal(config.maxOutputTokens,2000);
 return {ok:false,status:models.length%2?503:429,text:async()=>JSON.stringify({error:{message:'Busy'}})};
 }});
 const response=res();await handler(req(),response);
 assert.deepEqual(models,['primary','fallback','primary','fallback','primary','fallback','primary']);
 assert.deepEqual(waits,[2250,4250,8250,16250,20250,20250]);
 assert.equal(response.data.retryable,true);assert.equal(response.data.pauseQueue,false);
 assert.equal(logs.length,7);for(const log of logs)assert.deepEqual(Object.keys(log),['status','model','attempt']);
 assert.ok(!JSON.stringify(logs).includes('secret-value'));
});
test('retry stops immediately after a successful response',async()=>{
 let calls=0;const response=res();await createGeminiHandler({env:{GEMINI_API_KEY:'secret',GEMINI_MODEL:'primary'},wait:async()=>{},log:()=>{},request:async()=>++calls===1?{ok:false,status:503,text:async()=>''}:success(voucher)})(req(),response);
 assert.equal(calls,2);assert.equal(response.statusCode,200);
});

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/tests/local-env.test.js
````js
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadLocalGeminiEnv} from '../server/local-env.js';
import {createGeminiHandler} from '../api/read-voucher.js';

test('local server loads explicit project file, ignores empty shell overrides, reloads edits',()=>{
 const root=mkdtempSync(join(tmpdir(),'bill2sheet-env-'));
 try{
  writeFileSync(join(root,'.env.local'),'GEMINI_API_KEY=fixture-secret\nGEMINI_MODEL=fixture-model\n');
  const env=loadLocalGeminiEnv({root,inherited:{GEMINI_API_KEY:'',GEMINI_MODEL:'stale-shell-model'}});
  assert.deepEqual(env,{GEMINI_API_KEY:'fixture-secret',GEMINI_MODEL:'fixture-model',GEMINI_FALLBACK_MODEL:''});
  writeFileSync(join(root,'.env.local'),'GEMINI_API_KEY=replaced-fixture\nGEMINI_MODEL=fixture-model\n');
  assert.equal(loadLocalGeminiEnv({root,inherited:{}}).GEMINI_API_KEY,'replaced-fixture');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('missing file uses server environment; whitespace settings count as missing',()=>{
 const root=mkdtempSync(join(tmpdir(),'bill2sheet-env-'));
 try{assert.deepEqual(loadLocalGeminiEnv({root,inherited:{GEMINI_API_KEY:'  ',GEMINI_MODEL:'configured-model'}}),{GEMINI_API_KEY:'',GEMINI_MODEL:'configured-model',GEMINI_FALLBACK_MODEL:''});}
 finally{rmSync(root,{recursive:true,force:true});}
});
test('configuration endpoint and 503 expose variable names and booleans only',async()=>{
 for(const env of [{},{GEMINI_API_KEY:'fixture-secret'},{GEMINI_MODEL:'fixture-model'},{GEMINI_API_KEY:'fixture-secret',GEMINI_MODEL:'fixture-model',GEMINI_FALLBACK_MODEL:''}]){
  const response=()=>({setHeader(){},end(text){this.raw=text;this.data=JSON.parse(text);}});
  const handler=createGeminiHandler({env,request:()=>{throw Error('No provider call expected');}});
  const status=response();await handler({method:'GET',headers:{}},status);
  assert.equal(status.data.variables.GEMINI_API_KEY,Boolean(env.GEMINI_API_KEY));
  assert.equal(status.data.variables.GEMINI_MODEL,Boolean(env.GEMINI_MODEL));
  assert.ok(!status.raw.includes('fixture-secret'));
  if(!status.data.configured){const error=response();await handler({method:'POST',headers:{},body:{}},error);assert.equal(error.statusCode,503);for(const name of status.data.missing)assert.ok(error.data.error.includes(name));assert.ok(!error.raw.includes('fixture-secret'));}
 }
});

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/tests/gemini-queue.ui.test.jsx
````jsx
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
  fetch.mockImplementation(async()=>({ok:true,json:async()=>({voucher_date:'27-06-2026',paid_to:'Gas Both Camp',particulars:null,row_amounts:[1725],total:1725,unclear:[]})}));
  await retryBill('gemini-first','gemini');
  await waitFor(async()=>expect((await getRecord('gemini-next')).status).toBe('saved'),{timeout:8000});
  const rows=await listRecords();expect(rows).toHaveLength(2);expect(rows.every(b=>b.total===1725&&b.vendor==='Gas Both Camp')).toBe(true);
  await uploadPhoto({id:'gemini-first',file:new Blob(['retry']),reader:'gemini'});expect(await listRecords()).toHaveLength(2);
 }finally{for(const b of await listRecords())await removeRecord(b.id);vi.unstubAllGlobals();}
});
test('all-null reading stays a failed photo, never a saved voucher',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({voucher_date:null,paid_to:null,particulars:null,row_amounts:[],total:null,unclear:[{field:'total',note:'Unreadable'}]})})));
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
  request.mockImplementation(async()=>({ok:true,json:async()=>({voucher_date:null,paid_to:'Test',particulars:null,row_amounts:[10],total:10,unclear:[]})}));
  await resumeProcessing();
  await waitFor(async()=>expect((await getRecord('stop-first')).status).toBe('saved'),{timeout:8000});
  expect((await getRecord('stop-first')).total).toBe(10);
  expect(await listRecords()).toHaveLength(1);
 }finally{for(const b of await listRecords())await removeRecord(b.id);localStorage.clear();vi.unstubAllGlobals();}
});

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/tests/queue-delay.ui.test.jsx
````jsx
import {test,expect,vi} from 'vitest';
import {waitBetweenPhotos} from '../src/queue-delay.js';
test('voucher spacing waits 2–3 seconds',async()=>{
 vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0.5);
 try{let done=false;const task=waitBetweenPhotos().then(()=>{done=true;});await vi.advanceTimersByTimeAsync(2499);expect(done).toBe(false);await vi.advanceTimersByTimeAsync(1);await task;expect(done).toBe(true);}
 finally{vi.useRealTimers();vi.restoreAllMocks();}
});

````

## /Users/noufalrizwanm/.codex/.chatgpt-projects/g-p-6ac1059809748191a5c7ccc0df30b76b/bill2sheet/README.md
````md
# Bill2Sheet — Gemini voucher reader

React + Vite + Tailwind; server-only Gemini vision; IndexedDB photo queue/register; editable Excel and PDF exports. Only the foreground voucher is requested. All fields are optional. AI output must be checked against the photo; exact handwriting is not guaranteed.

## Configure privately

Install Node.js 22.12 or later. Open a terminal in this folder and run `npm install`. Create `.env.local` (or edit the existing file; do not overwrite a working key):

```dotenv
GEMINI_API_KEY=your_private_AI_Studio_key
GEMINI_MODEL=gemini-3.6-flash
```

No VITE_ prefix. Never commit or paste the key into chat. Both settings are required; there is no hard-coded model, allowlist or paid/provider fallback. The model above is documented at https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash . Check your project's model access and quota. Model availability does not guarantee free access; keep billing disabled if you only want free quota.

## Test key and model before starting

In this folder, load your private environment and run this single curl request. This checks model/key access, not handwriting accuracy. The subshell keeps settings out of later shell sessions; do not run with shell tracing enabled.

```sh
( set -a; . ./.env.local; set +a; curl --fail-with-body --silent --show-error --write-out '\nHTTP %{http_code}\n' "https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent" --header 'Content-Type: application/json' --header "x-goog-api-key: ${GEMINI_API_KEY}" --data '{"contents":[{"parts":[{"text":"Return JSON with ok equal to true."}]}],"generationConfig":{"responseMimeType":"application/json","temperature":0}}' )
```

HTTP 200 means the request succeeded. Otherwise Google returns its actual error: check model name/access for 404, key restrictions for 400/403, quota for 429. Never share request headers or the key.

## Run locally and on iPhone

```sh
npm run dev -- --host 0.0.0.0 --port 5173
```

Vite's server middleware runs the exact `/api/read-voucher` handler locally; no separate proxy or backend command is needed. Restart once after installing this update. The local API then rereads `.env.local` for each request. On the Mac open http://localhost:5173. On the iPhone, connect to the same Wi-Fi and open the Network URL Vite prints (for example http://192.168.1.242:5173). Use the actual printed port. The Mac must stay running for this local URL. File-input camera capture works without relying on getUserMedia. Allow local-network/firewall access if prompted.

## Vercel

Set the Vercel project Root Directory to `bill2sheet` (or the folder containing this package.json). Use Vite, build `npm run build`, output `dist`. Add GEMINI_API_KEY and GEMINI_MODEL in Vercel Settings → Environment Variables for the intended environment, then redeploy. `.env.local` is not uploaded. `/api/read-voucher.js` is the sole server function. Use the deployed HTTPS address on your phone; it does not require the Mac to stay on. This edit does not itself deploy your project.

## Flow and review

1. Take a photo or select multiple images. Original photos persist on this device as queue jobs, not successful vouchers.
2. HEIC is decoded natively or converted to JPEG; images are scaled to at most 1600 pixels on the longest side and compressed before sending.
3. Gemini reads the top voucher only, ignores signatures/background vouchers, and returns JSON. The Being line is included in particulars. Ambiguous digits stay null. A two-digit year stays null with the visible date in a review note because the century is not guessed; enter the full date after checking.
4. Readable results populate vendor, date, numeric total and items with reviewed:false. All-null results remain failed photo jobs with Retry/Edit; no empty successful voucher is created.
5. Unclear fields and row-total mismatches are red. Open Edit to compare the photo, crop/rotate and retry, change row amounts, and explicitly confirm resolved uncertainty. Save changes does not block on missing fields. Arithmetic mismatches remain red until corrected.
6. Export includes only rows with voucher data. Excel has Vouchers (No., PAID TO, Date, AMOUNT (AED), Review notes) and Line Items. PDF uses the same summary columns. Numeric totals remain editable numbers; unknown amounts remain blank. No numeric amounts means NO AMOUNTS ENTERED, not a misleading zero.

Queue pauses on provider/network errors; the real Google status/message appears beside the saved photo. Resume after fixing configuration/quota. No automatic cross-provider fallback. Keep the page open while reading; interrupted jobs resume when reopened.

Register/photos persist in IndexedDB on the same browser and origin, including after refresh. They do not sync between devices or between a Wi-Fi URL and Vercel. Export backups before clearing browser data. Downloading does not clear the register. An already downloaded workbook is not automatically rewritten.

## Checks

`npm test`, `npm run test:ui`, `npm run build`.

Automated checks cover provider contracts/errors, photo-queue pause/resume, blank-result rejection, 100 stored photos, numeric Excel round-trip and PDF pagination. Real handwriting accuracy and physical iPhone camera/HEIC capture still need a configured key and device test. Upload one voucher first; compare every digit, then try a batch and reopen the page before exporting.

## Diagnose missing server variables

The key check is in `api/read-voucher.js`. It expects exactly `GEMINI_API_KEY` and `GEMINI_MODEL`. `src/api.js` sends images to that endpoint and never reads the key. `server/local-env.js` loads the private file for Vite; it is not browser code. The Vercel function uses its injected process environment.

Run `npm run check:env` in this project. It prints the exact project root and only true/false for each setting. Local loading reads `.env.local` relative to the source project, independent of the terminal working directory. Nonempty file values take precedence over inherited shell values; neither value is changed. Missing/empty file entries fall back to the process environment.

After starting Vite, confirm the running server (not just the file) with:

```sh
curl --silent --show-error http://localhost:5173/api/read-voucher
```

The result has `variables.GEMINI_API_KEY` and `variables.GEMINI_MODEL` booleans, `configured`, and missing variable names. It never returns the key. Use the port shown by Vite if different. A 503 names missing variables. If the file check says true but the running endpoint says false, verify the URL/port and project copy, and stop/restart the old process.

No separate dev proxy is needed: Vite handles `/api/read-voucher` on its own server port. The iPhone uses that same relative endpoint, not localhost on the phone.

## Exact Vercel environment steps

1. Open Vercel dashboard → your Bill2Sheet project → Settings → Environment Variables.
2. Add `GEMINI_API_KEY` with your existing tested key. Select both Production and Preview. Save. Do not add a VITE_ prefix.
3. Add `GEMINI_MODEL` with your existing tested model value. Select both Production and Preview. Save. Leave Preview branch scope unrestricted unless you deliberately need an override.
4. Open Deployments. Choose the latest deployment with this updated source → three-dot menu → Redeploy. Redeploy Production and any Preview deployment you intend to test so each gets its scoped values. An older deployment does not acquire new variables automatically.
5. Open `/api/read-voucher` on the exact deployment URL; both booleans should be true. Then retry the queued photo in the app.

`.env.local` is ignored and is not uploaded to Vercel. Setting Production alone does not configure Preview. These edits do not deploy or change your Vercel settings automatically.

Official reference: https://vercel.com/docs/environment-variables

## Busy-model retries (local)

Optional `.env.local` setting:

```dotenv
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
```

Keep the existing GEMINI_API_KEY and GEMINI_MODEL. An empty/missing fallback means all attempts use the primary. No model is silently selected by the code. Both models use the same key and their respective project quotas.

503/429 responses get up to six retries after the first attempt (seven calls maximum), alternating primary/fallback. Waits are approximately 2, 4, 8, 16, 20, 20 seconds, each with 0–499 ms jitter. Other HTTP errors are not automatically retried. Each provider call has a 20-second timeout; client timeout is 240 seconds to cover the bounded retry sequence. A timed-out provider call is kept as a failed photo rather than retried automatically.

Requests use thinkingConfig.thinkingLevel low, maxOutputTokens 2000, temperature 0 and application/json output. All response text parts are joined. Production request logs contain only status, model and attempt. Keys, photos and extracted text are not logged.

The client reads one voucher at a time, with 2–3 seconds between jobs. Exhausted busy/quota failures remain in Retry failed, while later jobs continue. Authentication/model-configuration failures pause the queue. Use Retry failed photos to queue failures again; Stop processing still preserves originals and prevents further work. Closing/stopping the client aborts server retries when the HTTP connection closes; work already received by Google may still finish.

Restart the local server once after this update, then refresh the phone. Subsequent private environment edits are loaded on each request.

````
