export const textFields = ['bill_no', 'date', 'vendor', 'gst_no'];
export const amountFields = ['subtotal', 'gst_amount', 'total'];
const nullable = type => ({ type: [type, 'null'] });
const itemProperties = { name: nullable('string'), qty: nullable('number'), rate: nullable('number'), amount: nullable('number') };
export const billSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    ...Object.fromEntries(textFields.map(k => [k, nullable('string')])),
    items: { type: ['array', 'null'], items: { type: 'object', additionalProperties: false, properties: itemProperties, required: Object.keys(itemProperties) } },
    ...Object.fromEntries(amountFields.map(k => [k, nullable('number')])),
  },
  required: [...textFields, 'items', ...amountFields],
};
export const emptyItem = () => ({ name: null, qty: null, rate: null, amount: null });
export const emptyBill = () => ({ ...Object.fromEntries([...textFields, ...amountFields].map(k => [k, null])), items: [] });
export function isBill(bill) {
  if (!bill || typeof bill !== 'object' || Array.isArray(bill)) return false;
  const valid = (v, type) => v === null || (typeof v === type && (type !== 'number' || Number.isFinite(v)));
  return textFields.every(k => valid(bill[k], 'string')) && amountFields.every(k => valid(bill[k], 'number')) &&
    (bill.items === null || (Array.isArray(bill.items) && bill.items.length <= 1000 && bill.items.every(item =>
      item && valid(item.name, 'string') && ['qty','rate','amount'].every(k => valid(item[k], 'number')))));
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{2}-\d{2}-\d{4}$/.test(value)) return false;
  const [d, m, y] = value.split('-').map(Number);
  if (y < 1000) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function validateBill(bill) {
  const warnings = [];
  if (!validDate(bill.date)) warnings.push({ fields: ['date'], message: 'Enter a valid date as DD-MM-YYYY.' });
  if (bill.items === null || !bill.items.length || bill.items.some(i => i.amount === null) || bill.subtotal === null) {
    warnings.push({ fields: ['items', 'subtotal'], message: 'Item amounts or subtotal are missing; the sum cannot be checked.' });
  } else {
    const sum = bill.items.reduce((s, i) => s + Math.round(i.amount * 100), 0);
    if (Math.abs(sum - Math.round(bill.subtotal * 100)) > 1) warnings.push({ fields: ['items', 'subtotal'], message: 'Item amounts do not match the subtotal.' });
  }
  if (amountFields.some(k => bill[k] === null)) warnings.push({ fields: amountFields, message: 'Subtotal, GST, or total is missing; the total cannot be checked.' });
  else if (Math.abs(Math.round(bill.subtotal * 100) + Math.round(bill.gst_amount * 100) - Math.round(bill.total * 100)) > 1) warnings.push({ fields: amountFields, message: 'Subtotal + GST does not match the total.' });
  return warnings;
}
export const grandTotal = bills => bills.reduce((sum, b) => sum + (Number.isFinite(b.total) ? Math.round(b.total * 100) : 0), 0) / 100;
export const sortBills = bills => [...bills].sort((a, b) => {
  const key = date => validDate(date) ? date.split('-').reverse().join('') : '99999999';
  return key(a.date).localeCompare(key(b.date));
});
export const money = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value);
