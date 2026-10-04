import { useState } from 'react';
export async function cropPhoto(source, bounds, turns=0) {
  const image=new Image();image.src=source;await image.decode();
  const rotated=document.createElement('canvas');
  rotated.width=turns%2?image.naturalHeight:image.naturalWidth;
  rotated.height=turns%2?image.naturalWidth:image.naturalHeight;
  const context=rotated.getContext('2d');
  context.translate(rotated.width/2,rotated.height/2);context.rotate(turns*Math.PI/2);
  context.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2);
  const canvas=document.createElement('canvas');
  const x=rotated.width*bounds.left/100,y=rotated.height*bounds.top/100;
  const width=rotated.width*(100-bounds.left-bounds.right)/100,height=rotated.height*(100-bounds.top-bounds.bottom)/100;
  canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));
  canvas.getContext('2d').drawImage(rotated,x,y,width,height,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.92);
}
export default function Cropper({source,onApply,onClose,heading='Keep only the paper',actionLabel='Crop and read again'}) {
  const [bounds,setBounds]=useState({top:0,right:0,bottom:0,left:0});
  const [current,setCurrent]=useState(source),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function rotate(){setBusy(true);try{setCurrent(await cropPhoto(current,{top:0,right:0,bottom:0,left:0},1));setBounds({top:0,right:0,bottom:0,left:0});}catch{setError('Cannot rotate this image. Try uploading JPEG.');}finally{setBusy(false);}}
  async function apply(){setBusy(true);try{await onApply(await cropPhoto(current,bounds));}catch(error){setError(error.message);}finally{setBusy(false);}}
  return <section className="crop-tool" aria-label="Crop voucher"><h3>{heading}</h3><p>Move each edge until the clear area contains only the voucher. The original photo is retained.</p><div className="crop-preview"><img src={current} alt="Voucher crop preview"/><div className="crop-selection" style={{top:`${bounds.top}%`,right:`${bounds.right}%`,bottom:`${bounds.bottom}%`,left:`${bounds.left}%`}}/></div>{Object.keys(bounds).map(edge=><label className="crop-range" key={edge}><span>{edge} edge</span><input aria-label={`${edge} crop edge`} type="range" min="0" max={Math.max(0,98-bounds[{top:'bottom',bottom:'top',left:'right',right:'left'}[edge]])} value={bounds[edge]} onChange={e=>setBounds({...bounds,[edge]:Number(e.target.value)})}/><span>{bounds[edge]}%</span></label>)}{error&&<p role="alert">{error}</p>}<div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={rotate}>Rotate</button><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="button" disabled={busy} onClick={apply}>{busy?'Saving…':actionLabel}</button></div></section>;
}
