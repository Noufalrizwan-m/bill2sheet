import { emptyBill, validDate } from './bill.js';
import { parseNumber } from './parse-ocr.js';
export const HANDWRITING_MODEL = 'Xenova/trocr-small-handwritten';
export const HANDWRITING_DTYPE = { encoder_model: 'fp32', decoder_model_merged: 'q8' };
export function handwrittenValue(field, text) {
  const value = (text || '').trim();
  if (!value || value.length > 250) return null;
  if (field === 'vendor') return value;
  if (field === 'total') return parseNumber(value);
  if (field === 'date') {
    const match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return null;
    const date = `${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}-${match[3]}`;
    return validDate(date) ? date : null;
  }
  return null;
}
// Only locate fields from visible labels. No coordinates or values from a user's
// reference bill are encoded in the production reader.
export function locateHandwriting(lines, width, height) {
  const heading = lines.find(l => /PAYMENT\s+VOUCHER/i.test(l.text));
  if (!heading) return [];
  const footer = lines.filter(l => /Being the Amount|Prepared by|Passed by|Approved by/i.test(l.text) && l.bbox.y0 > heading.bbox.y1).sort((a,b)=>a.bbox.y0-b.bbox.y0)[0];
  const bottom = footer?.bbox.y0 ?? Math.min(height,heading.bbox.y0+height*.55);
  const below = lines.filter(l => l.bbox.y0 >= heading.bbox.y0 - height*.04 && l.bbox.y0 < bottom);
  const paid = below.find(l => /Paid\s+to/i.test(l.text));
  const particulars = below.find(l => /Particulars/i.test(l.text));
  const date = below.find(l => /\bDate\b/i.test(l.text) && l.bbox.x0 > width*.55 && l.bbox.y0 < (particulars?.bbox.y0 ?? heading.bbox.y1+height*.15));
  const total = below.find(l => /^\s*TOTAL\s*$/i.test(l.text));
  const regions = [];
  function add(field,left,top,right,bottom) {
    const x = Math.max(0,Math.round(left)),y=Math.max(0,Math.round(top));
    const w=Math.min(width,Math.round(right))-x,h=Math.min(height,Math.round(bottom))-y;
    if(w>=20 && h>=10)regions.push({field,x,y,width:w,height:h});
  }
  if(paid && particulars) {
    const labelHeight=paid.bbox.y1-paid.bbox.y0;
    add('vendor',paid.bbox.x1+width*.01,paid.bbox.y0-labelHeight*1.4,date?.bbox.x0 ?? width*.7,particulars.bbox.y0-height*.005);
  }
  if(date) {
    // A detected line may include both its label and handwriting. Retain it as a
    // suggestion; the user can select a tighter line if needed.
    add('date',date.bbox.x0,date.bbox.y0-height*.01,width*.95,date.bbox.y1+height*.01);
  }
  if(total) {
    const lineHeight=total.bbox.y1-total.bbox.y0;
    add('total',total.bbox.x1+width*.01,total.bbox.y0-lineHeight*1.8,width*.95,total.bbox.y1+lineHeight*.3);
  }
  return regions;
}
export function handwritingResult(suggestions, text = '') {
  return { bill: { ...emptyBill(), handwriting_suggestions:suggestions,
    uncertain_fields:['vendor','date','total'],
    recognition_note: 'Free handwriting suggestions need your check. Open Edit to copy a suggestion or correct it; unconfirmed fields stay blank in Excel.' }, text };
}
// Contrast stretch with percentile clipping; original pixels are never changed.
export function cleanHandwritingPixels(data, width, height, threshold=105) {
  const histogram=new Uint32Array(256),gray=new Uint8Array(width*height);
  for(let i=0;i<gray.length;i++){const n=i*4;gray[i]=Math.round(.299*data[n]+.587*data[n+1]+.114*data[n+2]);histogram[gray[i]]++;}
  function percentile(fraction){let count=0;for(let i=0;i<256;i++){count+=histogram[i];if(count>=gray.length*fraction)return i;}return 255;}
  const low=percentile(.01),high=percentile(.99),spread=Math.max(1,high-low);
  const output=new Uint8ClampedArray(width*height*4);let ink=0;
  for(let i=0;i<gray.length;i++){
    const value=(gray[i]-low)*255/spread<threshold?0:255;if(value===0)ink++;
    output.set([value,value,value,255],i*4);
  }
  return {data:output,inkRatio:ink/gray.length,contrast:high-low};
}
