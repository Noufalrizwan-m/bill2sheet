export function exportReview(records) {
  const pending=records.filter(b=>['queued','reading'].includes(b.status)).length;
  const blank=records.filter(b=>!b.vendor&&!b.date&&!b.source_date&&b.total==null&&!b.amount_text).length;
  const unchecked=records.filter(b=>!b.reviewed).length;
  return {pending,blank,unchecked,needed:pending>0||blank>0||unchecked>0};
}
export const hasNumericAmounts=records=>records.some(b=>typeof b.total==='number'&&Number.isFinite(b.total));
