import {validDate} from './bill.js';

// Recover only known notes about a readable two-digit year, never ambiguous digits.
export function recoverVoucherDate(bill){
 if(bill.date||!Array.isArray(bill.unclear))return null;
 const candidates=bill.unclear.filter(u=>u.field==='voucher_date').map(note=>{
  const match=note.note?.trim().match(/^(?:Year has only two digits:\s*)?(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2})\.?$/i);
  if(!match)return null;
  const date=`${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}-20${match[3]}`;
  return validDate(date)?{note,date}:null;
 });
 if(!candidates.length||candidates.some(v=>!v)||new Set(candidates.map(v=>v.date)).size!==1)return null;
 const unclear=bill.unclear.filter(u=>u.field!=='voucher_date');
 return {date:candidates[0].date,unclear,uncertain_fields:(bill.uncertain_fields||[]).filter(f=>f!=='date'),reviewed:false,
 recognition_note:[...unclear.map(u=>`${u.field}: ${u.note}`),'Two-digit year interpreted as 20xx. Check the date against the photo.'].join(' | ')};
}
