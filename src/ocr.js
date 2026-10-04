import { parseOCR } from '../shared/parse-ocr.js';
let workerPromise, progressListener, activeWorker, rejectWorkerError;
let generation = 0;
async function getWorker() {
  if (!workerPromise) workerPromise = (async () => {
    const currentGeneration = generation;
    const { createWorker, PSM } = await import('tesseract.js');
    const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
    const worker = await createWorker('eng', 1, {
      workerPath: `${base}worker.min.js`, corePath: base, langPath: base.replace(/\/$/, ''),
      logger: message => { if (currentGeneration === generation) progressListener?.({ stage: message.status === 'recognizing text' ? 'Reading text' : 'Preparing reader', progress: Math.round((message.progress || 0) * 100) }); },
      errorHandler: () => { if (currentGeneration === generation) rejectWorkerError?.(new Error('The local reader stopped. Please retry.')); },
    });
    if (currentGeneration !== generation) { await worker.terminate(); throw new Error('Reader preparation timed out. Please retry.'); }
    activeWorker = worker;
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
    return worker;
  })();
  return workerPromise;
}
export async function extractBill(image, onProgress) {
  progressListener = onProgress;
  let timer;
  const failure = new Promise((_, reject) => {
    rejectWorkerError = reject;
    timer = setTimeout(() => reject(new Error('Reading took too long on this device. Try a smaller, clearer photo and retry.')), 120_000);
  });
  try {
    const task = (async () => {
      const worker = await getWorker();
      const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
      if (!data.text?.trim()) throw new Error('No readable text was found. Retake the photo in good light, or enter the details manually.');
      return { bill: parseOCR(data), text: data.text, confidence: Math.round(data.confidence || 0) };
    })();
    return await Promise.race([task, failure]);
  } catch (error) {
    generation++;
    void activeWorker?.terminate().catch(() => {});
    activeWorker = null; workerPromise = undefined;
    throw new Error(error.message || 'The local reader could not start. Refresh and retry.');
  } finally {
    clearTimeout(timer); progressListener = undefined; rejectWorkerError = undefined;
  }
}

export async function scanPrintedLabels(image) {
  let timer;
  try {
    return await Promise.race([(async()=>{
      const worker=await getWorker();
      const {PSM}=await import('tesseract.js');
      try {
        await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
        const {data}=await worker.recognize(image,{}, {text:true,blocks:true});
        return {text:data.text||'',lines:(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).map(l=>({text:l.text||'',bbox:l.bbox,confidence:l.confidence})))).filter(l=>l.bbox)};
      } finally { await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK}); }
    })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Finding fields took too long. Retry or enter the details manually.')),90000);})]);
  } catch(error) {
    generation++;void activeWorker?.terminate().catch(()=>{});activeWorker=null;workerPromise=undefined;throw error;
  } finally { clearTimeout(timer); }
}
