import test from 'node:test';
import assert from 'node:assert/strict';
import {exportReview,hasNumericAmounts} from '../shared/export-review.js';
import {createVoucherWorkbook} from '../shared/voucher-export.js';
import {emptyBill} from '../shared/bill.js';
test('uploaded but unread photo warns before export and does not imply a zero total',async()=>{
 const rows=[{...emptyBill(),status:'saved',reviewed:false}];
 assert.deepEqual(exportReview(rows),{pending:0,blank:1,unchecked:1,needed:true});
 assert.equal(hasNumericAmounts(rows),false);
 const wb=await createVoucherWorkbook(rows);assert.equal(wb.Sheets.Vouchers.B3.v,'NO AMOUNTS ENTERED');assert.equal(wb.Sheets.Vouchers.D3,undefined);
});
test('zero is a real amount, checked rows export without warning, processing rows warn',()=>{
 const bill={...emptyBill(),vendor:'Checked name',date:'27-06-2026',total:0,status:'saved',reviewed:true};
 assert.equal(hasNumericAmounts([bill]),true);assert.equal(exportReview([bill]).needed,false);
 assert.equal(exportReview([{...bill,status:'reading'}]).pending,1);
});
