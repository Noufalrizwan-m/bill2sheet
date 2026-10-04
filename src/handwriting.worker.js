import { pipeline, env, RawImage } from '@huggingface/transformers';
import { HANDWRITING_MODEL, HANDWRITING_DTYPE, cleanHandwritingPixels } from '../shared/handwriting.js';
let reader;
env.allowRemoteModels=false;
env.localModelPath=new URL('/models/',self.location.origin).href;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.proxy=false;
env.backends.onnx.wasm.wasmPaths={
  mjs:new URL('/handwriting-runtime/ort-wasm-simd-threaded.mjs',self.location.origin).href,
  wasm:new URL('/handwriting-runtime/ort-wasm-simd-threaded.wasm',self.location.origin).href,
};
self.onmessage=async ({data:{id,pixels,width,height}})=>{
  try{
    const cleaned=cleanHandwritingPixels(pixels,width,height);
    if(cleaned.contrast<20||cleaned.inkRatio<.005||cleaned.inkRatio>.7)throw new Error('No clear handwritten line found. Select only the written line, or type the value.');
    if(!reader)reader=await pipeline('image-to-text',HANDWRITING_MODEL,{device:'wasm',dtype:HANDWRITING_DTYPE,progress_callback:info=>self.postMessage({id,type:'progress',message:info.status==='progress'?`Loading free reader: ${Math.round(info.progress||0)}%`:'Preparing free handwriting reader…'})});
    self.postMessage({id,type:'progress',message:'Reading the selected handwriting…'});
    const result=await reader(new RawImage(cleaned.data,width,height,4),{max_new_tokens:48});
    self.postMessage({id,type:'result',text:result[0]?.generated_text||''});
  }catch(error){self.postMessage({id,type:'error',message:'The free reader could not finish. Try a tighter crop or enter the value manually.',detail:error.message});}
};
