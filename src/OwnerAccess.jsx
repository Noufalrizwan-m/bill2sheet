import {useState} from 'react';
import {LockKeyhole,LoaderCircle} from 'lucide-react';

export const safeSignInLocation=location=>location.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(location.hostname);

export default function OwnerAccess({status,onChange}){
 const secureTransport=safeSignInLocation(window.location);
 const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!status?.authenticationRequired&&!status?.ownerAccess)return null;
 async function changeAccess(event){
  event.preventDefault();if(!secureTransport){setError('Open the HTTPS address to sign in.');return;}setBusy(true);setError('');
  try{
   const response=await fetch('/api/session',{method:status.ownerAccess?'DELETE':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},...(status.ownerAccess?{}:{body:JSON.stringify({password})})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not change access.');
   await onChange(Boolean(data.authenticated));
  }catch(error){setError(error.message);}finally{setPassword('');setBusy(false);}
 }
 return <section className="panel owner-access" aria-label="Owner access"><div><h2><LockKeyhole size={20}/>Photo reading is private</h2><p>{status.ownerAccess?'You are signed in. Your Gemini key stays on the server.':!secureTransport?'Open the HTTPS address to sign in. Do not enter an access password on a plain HTTP connection.':status.accessConfigured?'Sign in to read photos. You can still view, edit, and export records saved in this browser.':'Photo reading is locked until the site owner finishes access setup. You can still edit and export saved records.'}</p></div>{secureTransport&&(status.accessConfigured||status.ownerAccess)&&<form onSubmit={changeAccess}>{!status.ownerAccess&&<label className="field"><span>Owner access password</span><input aria-label="Owner access password" type="password" autoComplete="current-password" value={password} maxLength={256} required onChange={event=>setPassword(event.target.value)} disabled={busy}/></label>}<button className={`button ${status.ownerAccess?'secondary':'primary'}`} disabled={busy}>{busy&&<LoaderCircle size={17} className="spin"/>}{status.ownerAccess?'Sign out':'Sign in to read photos'}</button></form>}{error&&<p role="alert">{error}</p>}</section>;
}
