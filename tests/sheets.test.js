import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {getSheets,createSheet,selectSheet,inSheet} from '../src/sheets.js';
import {addRecord,listRecords,removeRecord} from '../src/register.js';
import {createVoucherExcelBytes} from '../shared/voucher-export.js';
import {unzipSync,strFromU8} from 'fflate';
import * as XLSX from 'xlsx';
test('new sheets preserve original records and photo ownership across selection and reopen',async()=>{
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 try{
  assert.equal(getSheets().active,'original');
  await addRecord({id:'old',name:'old.jpg',file:new Blob(['old'])});
  const sheet=createSheet('October');
  await addRecord({id:'new',name:'new.jpg',file:new Blob(['new']),sheetId:sheet.id});
  const records=await listRecords();
  assert.deepEqual(records.filter(b=>inSheet(b,sheet.id)).map(b=>b.id),['new']);
  selectSheet('original');assert.equal(getSheets().sheets.length,2);
  assert.deepEqual(records.filter(b=>inSheet(b,getSheets().active)).map(b=>b.id),['old']);
  const reopened=await import('../src/sheets.js?reopen');assert.equal(reopened.getSheets().active,'original');
  assert.equal(inSheet({id:'legacy'},'original'),true);
 }finally{for(const row of await listRecords())await removeRecord(row.id);delete globalThis.localStorage;}
});
test('downloaded Excel preserves particulars, numeric amounts and centered styles on both tabs',async()=>{
 const bytes=await createVoucherExcelBytes([{vendor:'Salary Staff',date:'01-07-2026',particulars:'July salary',total:3300,reviewed:true,items:[{name:'Salary',amount:3300,qty:null,rate:null}]}]);
 const wb=XLSX.read(bytes);assert.equal(wb.Sheets.Vouchers.E1.v,'Particulars');assert.equal(wb.Sheets.Vouchers.E2.v,'July salary');assert.equal(wb.Sheets.Vouchers.D2.t,'n');assert.equal(wb.Sheets.Vouchers.D4.v,3300);
 assert.deepEqual(wb.SheetNames,['Vouchers','Line Items']);
 const xml=strFromU8(unzipSync(bytes)['xl/styles.xml']);
 const styles=xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)[1];
 const cells=[...styles.matchAll(/<xf\b[^>]*>[\s\S]*?<\/xf>/g)];assert.ok(cells.length);for(const cell of cells)assert.match(cell[0],/horizontal="center" vertical="center"/);
});
