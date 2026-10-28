import { ArrowDown, Camera, Feather, FileSpreadsheet, ScanLine, CheckCheck, RotateCcw, Layers3 } from 'lucide-react';

const features = [
  [Camera, 'Capture a whole batch', 'Take a photo or add multiple images, including HEIC. Vouchers are read one at a time.'],
  [ScanLine, 'Keep the photo in view', 'Compare extracted details with the voucher. Crop, rotate, retry, or enter missing details yourself.'],
  [CheckCheck, 'Check before you export', 'Review uncertain fields and row-total mismatches. Edit amounts and dates with no required fields.'],
  [Layers3, 'Give each register a home', 'Create named sheets and keep your photos and records saved in this browser.'],
  [RotateCcw, 'Pick up where you paused', 'Stop and resume processing. Failed readings keep their photos so you can retry.'],
  [FileSpreadsheet, 'Take your work with you', 'Download editable Excel with line items, or a PDF summary. Your saved register stays here.'],
];

export function QuillMark() {
  return <span className="brand-mark" aria-hidden="true"><Feather size={25}/></span>;
}

export default function BrandIntro() {
  return <>
    <section className="quill-intro" aria-labelledby="intro-title">
      <div className="quill-intro-copy">
        <span className="eyebrow">THE VOUCHER-TO-EXCEL WORKSPACE</span>
        <h1 id="intro-title">Paper has a story.<br/><em>Give it a spreadsheet.</em></h1>
        <p>Turn voucher photos into a register you can check, edit, and keep. From handwritten details to Excel rows—with your review in between.</p>
        <a className="button primary" href="#capture">Add your first—or next—voucher <ArrowDown size={17}/></a>
        <span className="intro-caption">Snap. Check. Sheet.</span>
      </div>
      <div className="paper-process" aria-label="Workflow illustration: capture a voucher, review its details, export a sheet">
        <div className="paper-heading"><Feather size={18}/><span>THE PAPER TRAIL, REIMAGINED</span></div>
        <div className="paper-slip"><span className="paper-stamp">01 / CAPTURE</span><strong>Payment voucher</strong><span className="ink-line"/><span className="ink-line short"/><span className="handwritten">Every detail starts here.</span></div>
        <div className="paper-review"><CheckCheck size={20}/><div><b>02 / CHECK</b><span>Your photo. Your final say.</span></div></div>
        <div className="paper-sheet"><span className="paper-stamp">03 / EXPORT</span><div className="sheet-illustration"><span>PAID TO</span><span>DATE</span><span>AMOUNT</span><span>Reviewed</span><span>By you</span><span>Ready</span></div><span className="paper-formats">EXCEL + PDF <FileSpreadsheet size={17}/></span></div>
        <span className="illustration-note">A little less typing. A clearer paper trail.</span>
      </div>
    </section>
    <details className="quill-features">
      <summary><span>Built for the work between photo and spreadsheet</span><span className="feature-toggle">Explore 6 features <span aria-hidden="true">+</span></span></summary>
      <div className="feature-grid">{features.map(([Icon,title,description])=><article key={title}><Icon size={23} aria-hidden="true"/><h3>{title}</h3><p>{description}</p></article>)}</div>
    </details>
  </>;
}
