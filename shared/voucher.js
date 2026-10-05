import {validDate} from './bill.js';
export const hasVoucherData=b=>Boolean(b.vendor?.trim()||b.date||b.source_date||b.particulars?.trim()||Number.isFinite(b.total)||(b.items||[]).some(i=>Number.isFinite(i.amount)||i.name?.trim()));
export function voucherWarnings(bill){
 const warnings=(bill.unclear||[]).map(u=>`${u.field}: ${u.note}`);
 if(bill.date&&!validDate(bill.date))warnings.push('Check the date (DD-MM-YYYY).');
 if(bill.total!=null&&!Number.isFinite(bill.total))warnings.push('Check the amount.');
 const items=bill.items||[];
 if(items.some(i=>i.amount==null))warnings.push('One or more row amounts are unreadable.');
 if(items.length&&items.every(i=>Number.isFinite(i.amount))&&Number.isFinite(bill.total)&&Math.abs(items.reduce((s,i)=>s+Math.round(i.amount*100),0)-Math.round(bill.total*100))>1)warnings.push('Row amounts do not add up to the total.');
 return [...new Set(warnings)];
}
export const reviewNotes=b=>[...voucherWarnings(b),...(!b.reviewed?['Not yet reviewed']:[])].join(' | ');
