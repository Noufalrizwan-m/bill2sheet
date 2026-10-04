import { locateHandwriting, handwritingResult } from '../shared/handwriting.js';
import { scanPrintedLabels } from './ocr.js';
let worker,requestId=0,serial=Promise.resolve();
function readPixels(pixels,width,height,onProgress){
  const task=()=>new Promise((resolve,reject)=>{
    worker ||= new Worker(new URL('./handwriting.worker.js',import.meta.url),{type:'module'});
    const current=worker,id=++requestId;
    const cleanup=()=>{clearTimeout(timer);current.removeEventListener('message',message);current.removeEventListener('error',failed);};
    const failed=()=>{cleanup();current.terminate();worker=null;reject(new Error('Handwriting reader stopped. Retry or enter the text manually.'));};
    const timer=setTimeout(()=>{cleanup();current.terminate();worker=null;reject(new Error('Handwriting reading took too long on this device. Retry a smaller crop or enter the text manually.'));},180000);
    function message(event){if(event.data.id!==id)return;if(event.data.type==='progress')onProgress?.(event.data.message);else{cleanup();if(event.data.type==='error')reject(new Error(event.data.message));else resolve(event.data.text);}}
    current.addEventListener('message',message);current.addEventListener('error',failed);
    current.postMessage({id,pixels,width,height},[pixels.buffer]);
  });
  const result=serial.then(task,task);serial=result.catch(()=>{});return result;
}
async function photoCanvas(source){
  const image=new Image();image.src=source;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  canvas.getContext('2d').drawImage(image,0,0);return canvas;
}
export async function readHandwrittenLine(source,onProgress){
  const canvas=await photoCanvas(source);
  const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
  return readPixels(data,canvas.width,canvas.height,onProgress);
}
export async function extractHandwrittenVoucher(source,onProgress){
  onProgress?.('Finding voucher fields…');
  const canvas=await photoCanvas(source);
  const labels=await scanPrintedLabels(source);
  const regions=locateHandwriting(labels.lines,canvas.width,canvas.height);
  const suggestions={};
  for(const region of regions){
    onProgress?.(`Reading ${region.field==='vendor'?'paid to':region.field}…`);
    const pixels=canvas.getContext('2d').getImageData(region.x,region.y,region.width,region.height);
    try{suggestions[region.field]=await readPixels(pixels.data,region.width,region.height,onProgress);}
    catch(error){suggestions.error=error.message;break;}
  }
  const result=handwritingResult(suggestions,labels.text);
  if(!regions.length)result.bill.recognition_note='The field locations were not clear. Open Edit → Read handwritten field and crop one line at a time. All fields are optional.';
  return result;
}
