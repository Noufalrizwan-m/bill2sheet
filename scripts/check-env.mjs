import {loadLocalGeminiEnv,projectRoot} from '../server/local-env.js';
const env=loadLocalGeminiEnv();
console.log(JSON.stringify({projectRoot,GEMINI_API_KEY:Boolean(env.GEMINI_API_KEY),GEMINI_MODEL:Boolean(env.GEMINI_MODEL)},null,2));
