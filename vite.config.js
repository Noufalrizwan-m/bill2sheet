import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {createSessionHandler} from './api/session.js';
import {createGeminiHandler} from './api/read-voucher.js';
import {loadLocalGeminiEnv,projectRoot} from './server/local-env.js';

export default defineConfig(()=>{
 const configure=server=>{
  // Same-origin API on the same port as Vite, including phone requests.
  // Read the private file on each request so corrections take effect immediately.
  server.middlewares.use('/api/session',(req,res,next)=>{
   if(req.url!=='/'&&!req.url?.startsWith('/?')&&req.url!=='')return next();
   return createSessionHandler({env:loadLocalGeminiEnv(),localDevelopment:true})(req,res);
  });
  server.middlewares.use('/api/read-voucher',(req,res,next)=>{
   if(req.url!=='/'&&!req.url?.startsWith('/?')&&req.url!==''&&!req.url?.startsWith('?'))return next();
   return createGeminiHandler({env:loadLocalGeminiEnv(),localDevelopment:true})(req,res);
  });
 };
 return {
  root:projectRoot,
  envDir:projectRoot,
  plugins:[react(),tailwindcss(),{name:'gemini-reader',configureServer:configure,configurePreviewServer:configure}],
  worker:{format:'es'},
  optimizeDeps:{include:['heic-to','xlsx','jspdf','jspdf-autotable']}
 };
});
