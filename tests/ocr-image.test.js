import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker, PSM } from 'tesseract.js';
import { parseOCR } from '../shared/parse-ocr.js';
import { validateBill } from '../shared/bill.js';
test('actual local OCR reads a printed bill image and returns editable fields', {timeout:45000}, async () => {
  const worker = await createWorker('eng', 1, {langPath:new URL('../public/ocr', import.meta.url).pathname, gzip:true,cacheMethod:'none'});
  try {
    await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:'1'});
    const { data } = await worker.recognize(new URL('./fixtures/printed-bill.png',import.meta.url).pathname, {}, {text:true,blocks:true});
    const bill = parseOCR(data);
    assert.equal(bill.bill_no, '00042');
    assert.equal(bill.date, '24-10-2026');
    assert.equal(bill.vendor, 'Corner Stationery');
    assert.equal(bill.subtotal, 100);
    assert.equal(bill.gst_amount, 18);
    assert.equal(bill.total, 118);
    assert.deepEqual(bill.items, [{name:'Paper',qty:2,rate:50,amount:100}]);
    assert.deepEqual(validateBill(bill), []);
    assert.ok(data.text.includes('Grand Total'));
  } finally { await worker.terminate(); }
});
