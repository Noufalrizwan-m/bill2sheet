import { emptyBill, validDate } from './bill.js';
import { parseNumber } from './parse-ocr.js';
const middle = box => box.y + box.height / 2;
const unique = values => { const list = [...new Set(values.filter(v => v !== null && v !== ''))]; return list.length === 1 ? list[0] : null; };
export function readVoucher(boxes) {
  const bill = { ...emptyBill(), document_type: 'payment_voucher', particulars: null, payment_method: null, debit_account: null, credit_account: null, amount_words: null, notes: null, source_date: null };
  const usable = boxes.filter(b => typeof b.text === 'string' && b.confidence >= .7);
  const heading = usable.find(b => /PAYMENT\s+VOUCHER/i.test(b.text));
  if (!heading) return { ...bill, recognition_note: 'Payment voucher heading not found. The photo is saved; enter or check the details manually.' };
  const particulars = usable.find(b => /^Particulars$/i.test(b.text));
  const paidLabel = usable.find(b => /Paid\s+to/i.test(b.text));
  const totalLabel = usable.filter(b => /^TOTAL\s*[:.]?$/i.test(b.text) && b.y > heading.y).sort((a,b) => a.y-b.y)[0];
  const headerBottom = particulars?.y ?? heading.y + .18;
  const totalY = totalLabel?.y ?? heading.y + .55;
  // Only the voucher's header and table are considered. Another invoice below
  // the voucher, signatures and footer text are never used as payment fields.
  const header = usable.filter(b => b.y >= heading.y - .05 && b.y <= headerBottom);
  if (paidLabel) {
    const combined = paidLabel.text.replace(/^.*?Paid\s+to\s*(?:Mr\.?\s*\/\s*Messrs\.?)?\s*[:.]*\s*/i, '').trim();
    bill.vendor = combined || unique(header.filter(b => b !== paidLabel && b.x >= paidLabel.x + paidLabel.width*.75 && b.x < .7 && Math.abs(middle(b)-middle(paidLabel)) < .05 && !/Particulars|Date|VOUCHER|Cash|A\/c/i.test(b.text)).map(b=>b.text.trim()));
  }
  const dates = header.filter(b => b.x > heading.x).flatMap(b => [...b.text.matchAll(/\b(\d{1,2})[\s/.|-]+(\d{1,2})[\s/.|-]+(\d{2}|\d{4})\b/g)].map(match=>match.slice(1)));
  if (dates.length === 1) {
    const [day,month,year] = dates[0];
    bill.source_date = `${day}/${month}/${year}`;
    const date = `${day.padStart(2,'0')}-${month.padStart(2,'0')}-${year.length===2 ? `20${year}` : year}`;
    if (validDate(date)) bill.date = date;
  }
  if (totalLabel) bill.total = unique(usable.filter(b=>b.x >= totalLabel.x + totalLabel.width*.7 && Math.abs(middle(b)-middle(totalLabel)) < .055).map(b=>parseNumber(b.text.trim())));
  const amountHeader = usable.find(b => /^Amount$/i.test(b.text) && b.x > .65 && b.y < totalY && b.y >= heading.y);
  const cashHeader = usable.find(b=>/Cash\s*\/\s*Chq/i.test(b.text));
  if (amountHeader) {
    const amountRows = usable.filter(b=>b.x > amountHeader.x-.055 && b.y > amountHeader.y+.02 && b.y < totalY-.04 && parseNumber(b.text.trim()) !== null).sort((a,b)=>a.y-b.y);
    bill.items = amountRows.map(row => ({ name: usable.filter(b=>b.x > (paidLabel?.x ?? .1)+.07 && b.x < (cashHeader?.x ?? .6) && Math.abs(middle(b)-middle(row)) < .03 && !/^\d+[.)]?$/.test(b.text)).map(b=>b.text).join(' ') || null, qty:null, rate:null, amount:parseNumber(row.text.trim()) }));
    bill.particulars = bill.items.map(i=>i.name).filter(Boolean).join('; ') || null;
  }
  bill.recognition_note = `Handwriting was read locally. Please check it against the photo.${bill.source_date?.split('/')[2]?.length === 2 ? ' A two-digit year is displayed as 20xx; confirm the date.' : ''}`;
  return bill;
}
export function voucherWarnings(bill) {
  const warnings=[];
  if (bill.date && !validDate(bill.date)) warnings.push('Check the date (DD-MM-YYYY).');
  if (bill.total !== null && !Number.isFinite(bill.total)) warnings.push('Check the amount.');
  return warnings;
}
