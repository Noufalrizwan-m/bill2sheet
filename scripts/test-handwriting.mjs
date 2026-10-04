import { pipeline, env, RawImage } from '@huggingface/transformers';
import sharp from 'sharp';
import {cleanHandwritingPixels} from '../shared/handwriting.js';
import { mkdir } from 'node:fs/promises';
env.cacheDir = new URL('../.runtime/handwriting-cache/', import.meta.url).pathname;
await mkdir(env.cacheDir,{recursive:true});
const file=process.argv[2];if(!file)throw new Error('Pass a local bill photo path.');
console.log('Loading public handwriting model; photo stays local.');
const reader=await pipeline('image-to-text',process.argv[3]||'Xenova/trocr-base-handwritten',{dtype:process.argv[4]==='mixed'?{encoder_model:'fp32',decoder_model_merged:'q8'}:process.argv[4]||'q8',device:'cpu'});
const {width,height}=await sharp(file).metadata();
// Test-only manual regions of the supplied example. Production locates labels or uses user-selected regions.
const regions={vendor:[.26,.263,.52,.32],date:[.769,.230,.894,.273],total:[.802,.552,.879,.599]};
for(const [field,[left,top,right,bottom]] of Object.entries(regions)){
 const {data,info}=await sharp(file).extract({left:Math.round(left*width),top:Math.round(top*height),width:Math.round((right-left)*width),height:Math.round((bottom-top)*height)}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const cleaned=cleanHandwritingPixels(data,info.width,info.height);
 const start=Date.now();const output=await reader(new RawImage(cleaned.data,info.width,info.height,4),{max_new_tokens:48});
 console.log(JSON.stringify({field,result:output,ms:Date.now()-start}));
}
await reader.dispose();
