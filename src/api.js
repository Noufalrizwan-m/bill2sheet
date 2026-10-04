import { listRecords, getRecord, addRecord, patchRecord, removeRecord, importRecords } from './register.js';
import { compressImage } from './image.js';
import { extractBill } from './ocr.js';
import { extractHandwrittenVoucher } from './handwriting.js';
const urls = new Map();
let running = false;
async function drain() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const entry = (await listRecords()).find(b => b.status === 'queued');
      if (!entry) break;
      await patchRecord(entry.id, { status: 'reading' });
      try {
        if (!entry.original) throw new Error('Original photo unavailable. Enter the details manually.');
        const image = entry.preparedImage || await compressImage(entry.original);
        await patchRecord(entry.id, { preview: image });
        let result;
        if (entry.reader === 'local') result = await extractBill(image);
        else {
          let lastProgress=0;
          result=await extractHandwrittenVoucher(image,message=>{
            if(Date.now()-lastProgress>750){lastProgress=Date.now();void patchRecord(entry.id,{reading_progress:message}).catch(()=>{});}
          });
        }
        const checked = entry.reviewed ? {vendor:entry.vendor,date:entry.date,total:entry.total} : {};
        await patchRecord(entry.id, { ...result.bill, ...checked, raw_text: result.text, status: 'saved', reviewed: false,
          recognition_note: result.bill.recognition_note || 'Local recognition: check handwritten values; blanks need manual entry.' });
      } catch (error) {
        await patchRecord(entry.id, { status: 'error', error: error.message });
      }
    }
  } finally { running = false; }
}
let recovered = false;
export async function getRegister() {
  if (!recovered) {
    recovered = true;
    for (const bill of await listRecords()) if (bill.status === 'reading') await patchRecord(bill.id, { status: 'queued' });
  }
  const bills = await listRecords();
  for (const bill of bills) {
    if (bill.preview) bill.photoUrl = bill.preview;
    else if (bill.original) {
      if (!urls.has(bill.id)) urls.set(bill.id, URL.createObjectURL(bill.original));
      bill.photoUrl = urls.get(bill.id);
    }
  }
  void drain().catch(console.error);
  return { bills, readerAvailable: true };
}
export async function uploadPhoto(entry) { const record = await addRecord(entry); void drain().catch(console.error); return record; }
export async function updateBill(id, bill) {
  const { original, preview, photoUrl, ...fields } = bill;
  return patchRecord(id, { ...fields, status: 'saved', reviewed: true });
}
export async function deleteBill(id) { await removeRecord(id); if (urls.has(id)) URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
export async function retryBill(id, reader = 'handwriting') { if (await getRecord(id)) await patchRecord(id, { status: 'queued', error: null, reader }); void drain().catch(console.error); }
export const importLegacy = importRecords;

export async function cropAndRetry(id, image, reader) { await patchRecord(id, {preparedImage:image,preview:image,status:'queued',reader,error:null}); void drain().catch(console.error); }
