import { isBill } from '../shared/bill.js';
export const STORAGE_KEY = 'bill2sheet.bills.v1';
export function loadBills() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bills: [], error: null };
    const value = JSON.parse(raw);
    if (!Array.isArray(value) || value.some(b => !isBill(b) || typeof b.id !== 'string')) throw new Error();
    return { bills: value, error: null };
  } catch { return { bills: [], error: 'Saved bills could not be opened. Existing storage has been left untouched. Export any new bills before leaving.' }; }
}
export function saveBills(bills) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bills)); return null; }
  catch { return 'Device storage is full or unavailable. Your bills are still here for this session; export them before leaving.'; }
}
