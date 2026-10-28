import { useEffect, useState } from 'react';
import './paper-toss.css';

const trajectories=[[-43,-58,-115,22],[-28,-72,72,-32],[-10,-79,-38,45],[13,-72,135,-25],[36,-58,210,32],[48,-32,-145,-40],[-40,-24,165,38],[24,-38,-72,-28]];

export default function PaperToss(){
  const [visible,setVisible]=useState(()=>typeof window!=='undefined'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [loaded,setLoaded]=useState(0);
  const ready=loaded>=2;
  useEffect(()=>{
    if(!visible)return;
    const timer=window.setTimeout(()=>setVisible(false),ready?2900:8000);
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const stop=e=>{if(e.matches)setVisible(false);};
    media?.addEventListener('change',stop);
    return()=>{window.clearTimeout(timer);media?.removeEventListener('change',stop);};
  },[visible,ready]);
  if(!visible)return null;
  return <div className="paper-toss" data-ready={ready}>
    <button className="toss-skip" onClick={()=>setVisible(false)}>Skip intro</button>
    <div className="toss-caption" aria-hidden="true"><span>VoucherQuill</span><p>Enough with the paperwork.</p><small>Let’s put it in order.</small></div>
    <div className="toss-stage" aria-hidden="true">
      <div className="toss-hand"><img className="toss-hand-grip" src="/images/paper-toss-hand-grip.png" alt="" draggable="false" onLoad={()=>setLoaded(n=>n+1)} onError={()=>setVisible(false)}/><img className="toss-hand-open" src="/images/paper-toss-hand-3d.png" alt="" draggable="false" onLoad={()=>setLoaded(n=>n+1)} onError={()=>setVisible(false)}/></div>
      {trajectories.map(([x,y,rotation,flutter],i)=><div key={i} className={`toss-flight ${i%3===0?'toss-flight-rear':''}`} style={{'--fly-x':`${x}vw`,'--fly-y':`${y}vh`,'--rotation':`${rotation}deg`,'--flutter':`${flutter}deg`,'--delay':`${i*35}ms`,'--stack':`${i*-2}deg`,'--depth':`${i%3===0?-100:90}px`}}><div className="toss-paper"><span className="toss-paper-title">PAYMENT VOUCHER</span><span className="toss-rule"/><span className="toss-rule"/><span className="toss-rule short"/><span className="toss-scribble">check again!</span><div className="toss-paper-grid"/><span className="toss-paper-number">0{i+1}</span></div></div>)}
    </div>
  </div>;
}
