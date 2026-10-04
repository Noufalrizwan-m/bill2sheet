import { grandTotal, validateBill } from '../shared/bill.js';
export const billHeaders = ['Record ID', 'Bill no.', 'Date', 'Vendor', 'GST no.', 'Subtotal', 'GST amount', 'Total', 'Review notes'];
export const billRows = bills => bills.map(b => [b.id, b.bill_no, b.date, b.vendor, b.gst_no, b.subtotal, b.gst_amount, b.total, validateBill(b).map(w => w.message).join(' ') || 'Checked']);
const filename = extension => `Bill2Sheet-${new Date().toISOString().slice(0, 10)}.${extension}`;
export async function createWorkbook(bills) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([billHeaders, ...billRows(bills), [], ['', '', '', '', 'GRAND TOTAL', null, null, grandTotal(bills)]]);
  summary['!cols'] = [38, 18, 16, 32, 24, 18, 18, 18, 65].map(wch => ({ wch }));
  for (let r = 1; r <= bills.length; r++) for (const c of [5, 6, 7]) { const cell = summary[XLSX.utils.encode_cell({ r, c })]; if (cell) cell.z = '#,##0.00'; }
  const items = XLSX.utils.aoa_to_sheet([
    ['Record ID', 'Bill no.', 'Date', 'Vendor', 'Item', 'Quantity', 'Rate', 'Amount'],
    ...bills.flatMap(b => (b.items || []).map(i => [b.id, b.bill_no, b.date, b.vendor, i.name, i.qty, i.rate, i.amount])),
  ]);
  items['!cols'] = [38, 18, 16, 32, 36, 14, 18, 18].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, summary, 'Bills'); XLSX.utils.book_append_sheet(workbook, items, 'Line Items');
  return workbook;
}
export async function exportExcel(bills) {
  const XLSX = await import('xlsx');
  XLSX.writeFile(await createWorkbook(bills), filename('xlsx'));
}
export async function createPDF(bills) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const num = n => n === null ? '-' : n.toFixed(2);
  const plain = v => v === null ? '-' : String(v);
  autoTable(doc, {
    startY: 32, margin: { top: 32, bottom: 18, left: 14, right: 14 },
    head: [['Bill no.', 'Date', 'Vendor', 'GST no.', 'Subtotal', 'GST', 'Total', 'Review']],
    body: bills.map(b => [plain(b.bill_no), plain(b.date), plain(b.vendor), plain(b.gst_no), num(b.subtotal), num(b.gst_amount), num(b.total), validateBill(b).map(w => w.message).join(' ') || 'Checked']),
    foot: [['GRAND TOTAL', '', '', '', '', '', num(grandTotal(bills)), `${bills.length} bills`]],
    showFoot: 'lastPage', theme: 'grid', styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [34, 79, 65] }, footStyles: { fillColor: [235, 242, 237], textColor: [34, 79, 65] },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { cellWidth: 52 } },
    didParseCell(data) { if (data.section === 'body' && validateBill(bills[data.row.index]).length) data.cell.styles.fillColor = [255, 240, 238]; },
    didDrawPage() {
      doc.setTextColor(34, 79, 65); doc.setFontSize(20); doc.text('Bill2Sheet', 14, 17);
      doc.setTextColor(90); doc.setFontSize(9); doc.text(`Bill register | Generated ${new Date().toLocaleDateString('en-GB')} | Amounts in original bill currency`, 14, 24);
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setFontSize(9); doc.setTextColor(90); doc.text(`Page ${page} of ${pages}`, 283, 202, { align: 'right' }); }
  return doc;
}
export async function exportPDF(bills) {
  (await createPDF(bills)).save(filename('pdf'));
}
