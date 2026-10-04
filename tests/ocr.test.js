import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOCR, normalizeDate, parseNumber } from '../shared/parse-ocr.js';
import { isBill, sortBills } from '../shared/bill.js';
const text = `Vendor: Corner Stationery
Bill No: 00042
Date: 24-10-2026
GSTIN: 29ABCDE1234F1Z5
Item Qty Rate Amount
Paper A4 2 50.00 100.00
Pens 1 20.00 20.00
Subtotal: 120.00
GST Amount: 21.60
Grand Total: 141.60`;
test('local parser extracts printed fields and known item columns without a provider', () => {
  const bill = parseOCR(text);
  assert.equal(isBill(bill), true);
  assert.equal(bill.bill_no, '00042');
  assert.equal(bill.vendor, 'Corner Stationery');
  assert.equal(bill.date, '24-10-2026');
  assert.equal(bill.gst_no, '29ABCDE1234F1Z5');
  assert.equal(bill.total, 141.6);
  assert.equal(bill.gst_amount, 21.6);
  assert.deepEqual(bill.items[0], {name:'Paper A4',qty:2,rate:50,amount:100});
});
test('missing and conflicting amounts remain null; no tax or amount is calculated', () => {
  const bill = parseOCR('Subtotal: 100.00\nCGST: 9.00\nSGST: 9.00\nTotal: 118.00\nTotal: 119.00');
  assert.equal(bill.gst_amount, null); assert.equal(bill.total, null); assert.equal(bill.subtotal, 100);
  assert.equal(parseOCR('Grand Total: 1O0.OO').total, null);
  assert.equal(parseOCR('Some Shop\nItem Qty Rate Amount\nPaper 2 50.00').items.length, 0);
  assert.equal(parseOCR('Some Shop').vendor, null);
});
test('uncertain numeric words are excluded even on a high-confidence OCR line', () => {
  const bill = parseOCR({blocks:[{paragraphs:[{lines:[{text:'Total: 100.00',confidence:95,words:[{text:'Total:',confidence:98},{text:'100.00',confidence:42}]}]}]}]});
  assert.equal(bill.total, null);
  assert.equal(parseOCR({text:'Total: 100.00',confidence:45}).total, null);
});
test('date ambiguity and corrupted digits are not guessed', () => {
  assert.equal(normalizeDate('Date: 03/10/2026'), null);
  assert.equal(normalizeDate('Date: 2026-10-03'), '03-10-2026');
  assert.equal(normalizeDate('Date: 29/02/2025'), null);
  assert.equal(parseNumber('1,23,456.50'), 123456.5);
  assert.equal(parseNumber('1,234.50'), 1234.5);
  assert.equal(parseNumber('12,34'), null);
});
test('date order uses calendar chronology, with unreadable dates last', () => {
  const bills = [{date:null},{date:'02-02-2026'},{date:'24-01-2026'}];
  assert.deepEqual(sortBills(bills).map(b => b.date), ['24-01-2026','02-02-2026',null]);
  assert.equal(bills[0].date, null);
});
