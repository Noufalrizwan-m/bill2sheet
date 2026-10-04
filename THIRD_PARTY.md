# Third-party components

Bill2Sheet's field-parsing rules and interface are project code. Optical character recognition uses an existing open-source engine.

- Tesseract.js 6.0.1 — Apache-2.0; https://github.com/naptha/tesseract.js/tree/v6.0.1
- Tesseract.js core 6.x — Apache-2.0; https://github.com/naptha/tesseract.js-core
- English Tesseract model (`@tesseract.js-data/eng`) — Apache-2.0; https://github.com/naptha/tessdata
- heic-to 1.6.5 — LGPL-3.0; source: https://github.com/hoppergee/heic-to. Includes libheif; source: https://github.com/strukturag/libheif
- React — MIT; https://github.com/facebook/react
- SheetJS Community Edition 0.20.3 — Apache-2.0; https://git.sheetjs.com/sheetjs/sheetjs
- jsPDF — MIT; https://github.com/parallax/jsPDF
- jspdf-autotable — MIT; https://github.com/simonbengtsson/jsPDF-AutoTable
- Lucide icons — ISC; https://github.com/lucide-icons/lucide
- Vite and Tailwind CSS — MIT; see each installed package for its full license.

Full licenses and notices are included with dependencies installed by `npm ci`. The generated OCR assets retain their license headers. The HEIC decoder is loaded as a separate browser module, unmodified. Refer to the linked upstream source for modifications or redistribution.

Free handwriting additions:

- Transformers.js 4.3.0 — Apache-2.0; https://github.com/huggingface/transformers.js
- ONNX Runtime — MIT; https://github.com/microsoft/onnxruntime
- Microsoft TrOCR small handwritten model, browser conversion by Xenova: https://huggingface.co/microsoft/trocr-small-handwritten and https://huggingface.co/Xenova/trocr-small-handwritten. Model files are downloaded unmodified; see the upstream model card for training data, intended use and limitations. Model code source: https://github.com/microsoft/unilm/tree/master/trocr
