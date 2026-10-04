import test from 'node:test';
import assert from 'node:assert/strict';
import {handwrittenValue,handwritingResult,locateHandwriting,cleanHandwritingPixels} from '../shared/handwriting.js';
import {createVoucherWorkbook} from '../shared/voucher-export.js';
test('unconfirmed handwriting never becomes exported payee/date/amount',async()=>{
 const {bill}=handwritingResult({vendor:'Cross Both campaign',date:'27105126.',total:'( 7 2S.'});
 assert.equal(bill.vendor,null);assert.equal(bill.date,null);assert.equal(bill.total,null);
 const wb=await createVoucherWorkbook([{...bill,id:'sample'}]);
 assert.equal(wb.Sheets.Vouchers.B2,undefined);assert.equal(wb.Sheets.Vouchers.C2,undefined);assert.equal(wb.Sheets.Vouchers.D2,undefined);
 assert.equal(bill.handwriting_suggestions.vendor,'Cross Both campaign');
});
test('checked values never repair uncertain OCR characters or infer a century',()=>{
 assert.equal(handwrittenValue('total','1725'),1725);
 assert.equal(handwrittenValue('total','1,725.50'),1725.5);
 for(const value of ['( 7 2S.','1O0','1725 / 100',''])assert.equal(handwrittenValue('total',value),null);
 assert.equal(handwrittenValue('date','27/06/2026'),'27-06-2026');
 for(const value of ['27106126','27/06/26','31/02/2026'])assert.equal(handwrittenValue('date',value),null);
 assert.equal(handwrittenValue('vendor','Gas Both camp.'),'Gas Both camp.');
});
test('field finder requires foreground voucher anchors and does not use an invoice below it',()=>{
 const line=(text,x0,y0,x1,y1)=>({text,bbox:{x0,y0,x1,y1}});
 assert.deepEqual(locateHandwriting([line('Invoice Remarks',5,800,200,830)],1000,1000),[]);
 const regions=locateHandwriting([line('PAYMENT VOUCHER',400,150,650,180),line('Paid to Mr./Messrs',100,230,240,250),line('Particulars',300,300,450,320),line('Prepared by',100,700,250,730),line('TOTAL',100,900,450,930)],1000,1000);
 assert.equal(regions.length,1);assert.equal(regions[0].field,'vendor');assert.ok(regions[0].y+regions[0].height<300);
});
test('cleanup preserves original pixels and identifies blank crops',()=>{
 const data=new Uint8ClampedArray(400).fill(240);for(let i=3;i<data.length;i+=4)data[i]=255;
 const before=data.slice();const cleaned=cleanHandwritingPixels(data,10,10);
 assert.deepEqual(data,before);assert.equal(cleaned.contrast,0);
});
