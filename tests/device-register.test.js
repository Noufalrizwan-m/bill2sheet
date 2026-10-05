import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as XLSX from 'xlsx';
import { addRecord, listRecords, patchRecord, getRecord, removeRecord } from '../src/register.js';
import { createVoucherWorkbook, voucherHeaders } from '../shared/voucher-export.js';
import { emptyBill } from '../shared/bill.js';

test('100 sequential photos persist, duplicate retries do not append twice, edits and deletion persist', async()=>{
  for(let i=0;i<100;i++) await addRecord({id:`photo-${i}`,name:`${i}.jpg`,file:new Blob(['photo'],{type:'image/jpeg'})});
  await addRecord({id:'photo-0',name:'retry.jpg',file:new Blob(['retry'])});
  assert.equal((await listRecords()).length,100);
  await patchRecord('photo-0',{vendor:'Gas Both Camp',date:'27-06-2026',total:1725,status:'saved'});
  assert.equal((await getRecord('photo-0')).vendor,'Gas Both Camp');
  assert.equal(await (await getRecord('photo-0')).original.text(),'photo');
  const fresh = await import('../src/register.js?reopen=1');
  assert.equal((await fresh.listRecords()).length,100);
  await removeRecord('photo-99');
  assert.equal((await fresh.listRecords()).length,99);
  for(const record of await listRecords())await removeRecord(record.id);
});
test('Excel matches four requested columns and keeps numbers editable, dates ordered, combined written values intact',async()=>{
  const records=[{...emptyBill(),id:'2',vendor:'Gas Both Camp',date:'27-06-2026',total:1725},{...emptyBill(),id:'1',vendor:'Hamza Fees Cafeteria',date:'02-06-2026',total:512},{...emptyBill(),id:'3',vendor:'Expenses',source_date:'20-07-2026 / 23-07-2026',amount_text:'3114 / 100'}];
  const wb=await createVoucherWorkbook(records);
  const reopened=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}));
  const sheet=reopened.Sheets.Vouchers;
  assert.deepEqual(XLSX.utils.sheet_to_json(sheet,{header:1})[0],voucherHeaders);
  assert.equal(sheet.B2.v,'Hamza Fees Cafeteria');assert.equal(sheet.C3.v,'27-06-2026');
  assert.equal(sheet.D3.t,'n');assert.equal(sheet.D3.v,1725);
  assert.equal(sheet.C4.v,'20-07-2026 / 23-07-2026');assert.equal(sheet.D4,undefined);
  assert.equal(sheet.D6.v,2237);
});
test('current voucher PDF exports the requested headers and totals across pages',async()=>{
  const {createVoucherPDF}=await import('../shared/voucher-export.js');
  const doc=await createVoucherPDF(Array.from({length:100},(_,i)=>({...emptyBill(),id:String(i),date:'27-06-2026',vendor:'Test payee',total:10})));
  const content=doc.output();
  assert.ok(content.includes('PAID TO'));assert.ok(content.includes('AMOUNT'));
  assert.ok(content.includes('1000.00'));assert.ok(doc.getNumberOfPages()>1);
});
