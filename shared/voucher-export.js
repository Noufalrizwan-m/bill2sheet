import {centerWorkbook} from './center-workbook.js';
import {hasVoucherData,reviewNotes} from './voucher.js';
import {hasNumericAmounts} from './export-review.js';
import { grandTotal, sortBills } from './bill.js';
export const voucherHeaders = ['No.', 'PAID TO', 'Date', 'AMOUNT (AED)', 'Particulars', 'Review notes'];
export async function createVoucherWorkbook(records) {
  const XLSX = await import('xlsx');
  const bills = sortBills(records.filter(hasVoucherData));
  const rows = bills.map((b, i) => [i + 1, b.vendor, b.date || b.source_date, Number.isFinite(b.total)?b.total:null,b.particulars||null,reviewNotes(b)]);
  const sheet = XLSX.utils.aoa_to_sheet([voucherHeaders, ...rows, [], [null, hasNumericAmounts(bills)?'GRAND TOTAL (numeric amounts)':'NO AMOUNTS ENTERED', null, hasNumericAmounts(bills)?grandTotal(bills):null]]);
  sheet['!cols'] = [8, 36, 18, 20, 48, 65].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: `A1:F${bills.length + 1}` };
  for (let r = 1; r <= bills.length + 2; r++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 3 })];
    if (cell) cell.z = '#,##0.##';
  }
  const items = XLSX.utils.aoa_to_sheet([['No.', 'Date', 'Paid to', 'Description', 'Quantity', 'Rate', 'Amount'],
    ...bills.flatMap((b, index) => (b.items || []).map(i => [index + 1, b.date, b.vendor, i.name, i.qty, i.rate, i.amount]))]);
  items['!cols'] = [8, 20, 42, 44, 14, 18, 18].map(wch => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Vouchers');
  XLSX.utils.book_append_sheet(workbook, items, 'Line Items');
  return workbook;
}
export async function createVoucherExcelBytes(records){
 const XLSX=await import('xlsx');
 return centerWorkbook(XLSX.write(await createVoucherWorkbook(records),{type:'array',bookType:'xlsx'}));
}
const exportName=name=>(name||'VoucherQuill').replace(/[\\/:*?"<>|]/g,'-');
export async function downloadVoucherExcel(records,name){
 const bytes=await createVoucherExcelBytes(records);
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');link.href=url;link.download=`${exportName(name)}.xlsx`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function createVoucherPDF(records) {
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const bills=sortBills(records.filter(hasVoucherData)),doc=new jsPDF({orientation:'landscape',format:'a4'});
  autoTable(doc,{startY:30,margin:{top:30,bottom:18},head:[voucherHeaders],body:bills.map((b,i)=>[i+1,b.vendor||'',b.date||b.source_date||'',Number.isFinite(b.total)?b.total.toFixed(2):'',b.particulars||'',reviewNotes(b)]),foot:[['',hasNumericAmounts(bills)?'GRAND TOTAL':'NO AMOUNTS ENTERED','',hasNumericAmounts(bills)?grandTotal(bills).toFixed(2):'','','']],showFoot:'lastPage',styles:{fontSize:9,cellPadding:3,halign:'center',valign:'middle'},columnStyles:{4:{cellWidth:55},5:{cellWidth:65}},headStyles:{fillColor:[36,60,75]},didDrawPage(){doc.setFontSize(19);doc.text('VoucherQuill · Payment vouchers',148.5,17,{align:'center'});doc.setFontSize(9);doc.text('Amounts in AED. Check unreviewed handwriting against the original photo.',148.5,23,{align:'center'});}});
  for(let page=1;page<=doc.getNumberOfPages();page++){doc.setPage(page);doc.text(`${page} / ${doc.getNumberOfPages()}`,280,202,{align:'right'});}
  return doc;
}

export async function downloadVoucherPDF(records,name) { (await createVoucherPDF(records)).save(`${exportName(name)}.pdf`); }
