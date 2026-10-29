import { ArrowUpRight, Camera, Feather, FileSpreadsheet, ScanLine, CheckCheck, RotateCcw, Layers3 } from 'lucide-react';

const features = [
  [Camera, 'Add your photos', 'Take a picture or choose a batch from your device. HEIC photos work too.'],
  [ScanLine, 'Keep the original beside you', 'Check the reading against the photo. Crop, rotate, or try again if something is hard to read.'],
  [CheckCheck, 'Fix the little things', 'Change a name, date, or amount before exporting. Unclear details are marked for your attention.'],
  [Layers3, 'Keep separate sheets', 'Give each project or month its own sheet. Your records stay in this browser.'],
  [RotateCcw, 'Come back to it', 'Pause when you need to. If a reading fails, the photo stays here for another try.'],
  [FileSpreadsheet, 'Download a copy', 'Get an editable Excel file with line items, or a PDF summary. Your register stays here.'],
];

export function QuillMark(){return <span className="brand-mark" aria-hidden="true"><Feather size={23}/></span>;}

export function FeatureGuide(){return <section id="features" className="feature-guide" aria-labelledby="feature-title"><div className="guide-heading"><h2 id="feature-title">A few things that make it easier.</h2></div><div className="feature-grid">{features.map(([Icon,title,description])=><article key={title}><div className="feature-icon"><Icon size={22} aria-hidden="true"/></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>;}

export default function BrandIntro(){return <section className="quill-intro" aria-labelledby="intro-title"><div className="quill-intro-copy"><h1 id="intro-title">Your bills, without<br/><em>all the typing.</em></h1><p>A small tool for turning handwritten vouchers into Excel sheets. Add a photo, check the details, and save yourself a little work.</p><div className="intro-links"><a className="button primary" href="#capture">Start with a photo <ArrowUpRight size={19}/></a><a className="text-link" href="#features">How it works <span aria-hidden="true">↗</span></a></div></div><div className="paper-composition" aria-label="Illustration of a paper voucher becoming an Excel register"><div className="illustrated-voucher"><Feather size={23}/><strong>Payment<br/>voucher</strong><div className="receipt-lines"><i/><i/><i/></div><span className="handwritten">The original.</span></div><span className="transfer-arrow" aria-hidden="true">↘</span><div className="illustrated-sheet"><div className="sheet-mini-title"><FileSpreadsheet size={22}/><span>Excel register</span><CheckCheck size={20}/></div><div className="mini-grid"><b>Paid to</b><b>Date</b><b>Amount</b>{Array.from({length:9},(_,i)=><span key={i}><i/></span>)}</div></div></div></section>;}
