import test from 'node:test';
import assert from 'node:assert/strict';
import { validDate, validateBill, grandTotal, isBill, emptyBill } from '../shared/bill.js';
import { createWorkbook, createPDF } from '../src/export.js';
import { loadBills, saveBills, STORAGE_KEY } from '../src/storage.js';
import * as XLSX from 'xlsx';

const bill = { id: 'test-1', bill_no: '00042', date: '29-02-2024', vendor: 'Corner Stationery', gst_no: '001GST', items: [{name: 'Paper', qty: 2, rate: 50, amount: 100}], subtotal: 100, gst_amount: 18, total: 118 };
test('calendar validation rejects rollover dates and accepts leap days', () => {
  assert.equal(validDate('29-02-2024'), true);
  for (const date of ['29-02-2025', '31-04-2026', '00-10-2026', '01-13-2026', '2026-10-03', null]) assert.equal(validDate(date), false);
});
test('arithmetic validation catches discrepancies and missing values without mutation', () => {
  assert.deepEqual(validateBill(bill), []);
  const wrong = {...bill, subtotal: 90, total: 999, date: '31-02-2026'};
  assert.equal(validateBill(wrong).length, 3);
  assert.equal(wrong.total, 999);
  assert.equal(validateBill(emptyBill()).length, 3);
  assert.equal(isBill({...bill, total: '118'}), false);
  assert.equal(isBill({...bill, items: null}), true);
  assert.equal(isBill({...bill, total: Infinity}), false);
});
test('grand total uses cents and excludes unreadable totals', () => {
  assert.equal(grandTotal([{total: .1}, {total: .2}, {total: null}]), .3);
});
test('Excel round-trip retains numeric values, leading zeros and two joined tabs', async () => {
  const workbook = await createWorkbook([bill, {...bill, id:'test-2', total:null}]);
  const reopened = XLSX.read(XLSX.write(workbook, {type:'buffer', bookType:'xlsx'}), {type:'buffer'});
  assert.deepEqual(reopened.SheetNames, ['Bills','Line Items']);
  assert.equal(reopened.Sheets.Bills.B2.v, '00042');
  assert.equal(reopened.Sheets.Bills.H2.t, 'n');
  assert.equal(reopened.Sheets.Bills.H2.v, 118);
  assert.equal(reopened.Sheets.Bills.H5.v, 118);
  assert.equal(reopened.Sheets['Line Items'].A3.v, 'test-2');
  assert.equal(reopened.Sheets['Line Items'].H2.v, 100);
});
test('printable PDF repeats headers, paginates and includes total', async () => {
  const doc = await createPDF(Array.from({length:80}, (_,i) => ({...bill, id:String(i), bill_no:String(i)})));
  assert.ok(doc.getNumberOfPages() > 1);
  const pdf = doc.output();
  assert.ok(pdf.startsWith('%PDF-'));
  assert.ok(pdf.includes('GRAND TOTAL'));
  assert.ok(pdf.includes('9440.00'));
  assert.ok(pdf.includes('Page 1 of'));
});
test('storage round-trip and corrupt storage remain recoverable', () => {
  const values = new Map();
  globalThis.localStorage = {getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v)};
  assert.equal(saveBills([bill]), null);
  assert.deepEqual(loadBills().bills, [bill]);
  values.set(STORAGE_KEY, 'corrupted');
  assert.ok(loadBills().error);
  assert.equal(values.get(STORAGE_KEY), 'corrupted');
  globalThis.localStorage.setItem = () => {throw new Error('quota');};
  assert.ok(saveBills([bill]));
  delete globalThis.localStorage;
});
