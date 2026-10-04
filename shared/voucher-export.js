import { grandTotal, sortBills } from './bill.js';
export const voucherHeaders = ['No.', 'PAID TO', 'Date', 'AMOUNT (AED)'];
export async function createVoucherWorkbook(records) {
  const XLSX = await import('xlsx');
  const bills = sortBills(records);
  const rows = bills.map((b, i) => [i + 1, b.vendor, b.date || b.source_date, b.total ?? b.amount_text]);
  const sheet = XLSX.utils.aoa_to_sheet([voucherHeaders, ...rows, [], [null, 'GRAND TOTAL (numeric amounts)', null, grandTotal(bills)]]);
  sheet['!cols'] = [8, 42, 28, 24].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: `A1:D${bills.length + 1}` };
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
export async function downloadVoucherExcel(records) {
  const XLSX = await import('xlsx');
  XLSX.writeFile(await createVoucherWorkbook(records), 'Bill2Sheet.xlsx');
}
export async function createVoucherPDF(records) {
  const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const bills=sortBills(records),doc=new jsPDF({orientation:'landscape',format:'a4'});
  autoTable(doc,{startY:30,margin:{top:30,bottom:18},head:[voucherHeaders],body:bills.map((b,i)=>[i+1,b.vendor||'',b.date||b.source_date||'',b.total===null?(b.amount_text||''):b.total.toFixed(2)]),foot:[['','GRAND TOTAL','',grandTotal(bills).toFixed(2)]],showFoot:'lastPage',styles:{fontSize:9,cellPadding:3},columnStyles:{3:{halign:'right'}},headStyles:{fillColor:[34,79,65]},didDrawPage(){doc.setFontSize(19);doc.text('Bill2Sheet · Payment vouchers',14,17);doc.setFontSize(9);doc.text('Amounts in AED. Check unreviewed handwriting against the original photo.',14,23);}});
  for(let page=1;page<=doc.getNumberOfPages();page++){doc.setPage(page);doc.text(`${page} / ${doc.getNumberOfPages()}`,280,202,{align:'right'});}
  return doc;
}

export async function downloadVoucherPDF(records) { (await createVoucherPDF(records)).save('Bill2Sheet-vouchers.pdf'); }
