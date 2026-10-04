import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins:[react(),tailwindcss()],
  worker:{format:'es'},
  optimizeDeps:{include:['tesseract.js','heic-to','xlsx','jspdf','jspdf-autotable','@huggingface/transformers']},
});
