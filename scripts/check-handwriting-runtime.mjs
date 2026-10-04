import { pipeline, env } from '@huggingface/transformers';
env.cacheDir=new URL('../.runtime/handwriting-cache/',import.meta.url).pathname;
const reader=await pipeline('image-to-text','Xenova/trocr-small-handwritten',{device:'cpu',dtype:'fp32'});
const result=await reader('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/handwriting.jpg');
console.log(result);await reader.dispose();
