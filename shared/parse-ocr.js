import { emptyBill, validDate } from './bill.js';
// Copy printed values only. Never repair OCR digits or calculate missing amounts.
export function parseNumber(token) {
  if (typeof token !== 'string') return null;
  const value = token.trim();
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,4})?$/.test(value)) return null;
  const number = Number(value.replaceAll(',', ''));
  return Number.isFinite(number) && Math.abs(number) < 1e12 ? number : null;
}
export function normalizeDate(value) {
  let match = value.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  let d, m, y;
  if (match) [, y, m, d] = match;
  else {
    match = value.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
    if (!match) return null;
    [, d, m, y] = match;
    if (+d <= 12 && +d !== +m) return null;
  }
  const date = `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  return validDate(date) ? date : null;
}
const oneUnique = values => {
  const unique = [...new Set(values.filter(value => value !== null))];
  return unique.length === 1 ? unique[0] : null;
};
function amountAfter(value) {
  const clean = value.replace(/^\s*[:#=-]\s*/, '').replace(/\b\d+(?:\.\d+)?\s*%/g, '').replace(/\b(?:INR|AED|USD|Rs\.?)\b/gi, '').replace(/[₹$€£]/g, '').trim();
  return parseNumber(clean);
}
function inputLines(input) {
  if (typeof input === 'string') return input.split(/\r?\n/).map(text => ({ text, confidence: 100 }));
  const lines = (input.blocks || []).flatMap(block => (block.paragraphs || []).flatMap(p => p.lines || []));
  if (lines.length) return lines.map(line => ({
    text: line.text || (line.words || []).map(w => w.text).join(' '), confidence: line.confidence ?? 0,
    lowNumber: (line.words || []).some(w => /\d/.test(w.text) && (w.confidence ?? 0) < 80),
  }));
  return (input.text || '').split(/\r?\n/).map(text => ({ text, confidence: input.confidence ?? 0, lowNumber: (input.confidence ?? 0) < 80 }));
}
export function parseOCR(input) {
  const bill = emptyBill();
  const candidates = Object.fromEntries(['vendor','bill_no','gst_no','date','subtotal','gst_amount','total'].map(key => [key, []]));
  let table = false;
  for (const line of inputLines(input)) {
    const text = line.text.trim();
    if (!text || line.confidence < 65) continue;
    const numericSafe = !line.lowNumber && line.confidence >= 80;
    let match;
    if ((match = text.match(/^(?:vendor|supplier|seller)(?:\s+name)?\s*[:=-]\s*(.+)$/i))) candidates.vendor.push(match[1].trim());
    if ((match = text.match(/\b(?:bill|invoice|receipt)\s*(?:no\.?|number|#)\s*[:#=-]?\s*([A-Za-z0-9][A-Za-z0-9/._-]*)/i)) && numericSafe) candidates.bill_no.push(match[1]);
    if ((match = text.match(/\bGST(?:IN|\s*(?:no\.?|number))\s*[:#=-]?\s*([A-Za-z0-9]+)/i)) && numericSafe) candidates.gst_no.push(match[1]);
    if (/\bdate\b/i.test(text) && numericSafe) candidates.date.push(normalizeDate(text));
    const amountPatterns = [
      ['subtotal', /^(?:sub\s*total|taxable\s*(?:amount|value))\b\s*(.*)$/i],
      ['gst_amount', /^(?:total\s+GST|GST\s*(?:amount|total)|GST)\b\s*(.*)$/i],
      ['total', /^(?:grand\s*total|net\s*(?:total|amount)|amount\s*(?:due|payable)|total(?:\s+amount)?)\b\s*(.*)$/i],
    ];
    let summary = false;
    for (const [key, pattern] of amountPatterns) {
      match = text.match(pattern);
      if (match) { summary = true; table = false; if (numericSafe) candidates[key].push(amountAfter(match[1])); break; }
    }
    if (summary) continue;
    if (/\b(?:item|description|product)\b.*\b(?:qty|quantity)\b.*\b(?:rate|price)\b.*\b(?:amount|total)\b/i.test(text)) { table = true; continue; }
    if (!table) continue;
    if (/^(?:thank|terms|payment|cash|card|change|discount|[CS]GST|tax|round|balance)\b/i.test(text)) { table = false; continue; }
    // Only parse the known Name / Qty / Rate / Amount layout, with three printed columns.
    match = text.match(/^(.+?\S)\s+([+-]?[\d,.]+)\s+([+-]?[\d,.]+)\s+([+-]?[\d,.]+)\s*$/);
    if (!match || /\s[\d,.]+$/.test(match[1]) || !numericSafe) continue;
    const values = match.slice(2).map(parseNumber);
    if (values.some(v => v === null)) continue;
    bill.items.push({ name: match[1].trim(), qty: values[0], rate: values[1], amount: values[2] });
  }
  for (const [key, values] of Object.entries(candidates)) bill[key] = oneUnique(values);
  return bill;
}
