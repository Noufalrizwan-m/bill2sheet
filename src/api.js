import { listRecords, getRecord, addRecord, patchRecord, removeRecord, importRecords } from './register.js';
import {waitBetweenPhotos} from './queue-delay.js';
import { compressImage } from './image.js';
import {mapGeminiVoucher} from '../shared/gemini.js';
import {recoverVoucherDate} from '../shared/date-recovery.js';
import {hasVoucherData} from '../shared/voucher.js';
import {activeSheetId,inSheet} from './sheets.js';
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
      const records=(await listRecords()).filter(b=>inSheet(b,activeSheetId()));
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
  const bills = (await listRecords()).filter(b=>inSheet(b,activeSheetId()));
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
 for(const bill of await listRecords())if(inSheet(bill,activeSheetId())&&['error','paused'].includes(bill.status))await patchRecord(bill.id,{status:'queued',error:null,reading_progress:null});
 await resumeProcessing();
}
