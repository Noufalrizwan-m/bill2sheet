import { mkdir, copyFile, access, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const model='Xenova/trocr-small-handwritten';
const files=['config.json','generation_config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','onnx/encoder_model.onnx','onnx/decoder_model_merged_quantized.onnx'];
for(const file of files){
 const target=resolve(root,'public/models',model,file);await mkdir(dirname(target),{recursive:true});
 try{await access(target);continue;}catch{}
 const cached=resolve(root,'.runtime/handwriting-cache',model,file);
 try{await copyFile(cached,target);}catch{
  console.log(`Downloading free handwriting asset: ${file}`);
  const response=await fetch(`https://huggingface.co/${model}/resolve/main/${file}`,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw new Error(`Handwriting model download failed (${response.status}). Run npm run prepare:handwriting to retry.`);
  await writeFile(`${target}.tmp`,new Uint8Array(await response.arrayBuffer()));await rename(`${target}.tmp`,target);
 }
}
const runtime=resolve(root,'public/handwriting-runtime');await mkdir(runtime,{recursive:true});
for(const file of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])await copyFile(resolve(root,'node_modules/onnxruntime-web/dist',file),resolve(runtime,file));
console.log('Free handwriting model ready. Photos are processed on the device.');
