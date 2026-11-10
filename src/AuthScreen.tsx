import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Package} from 'lucide-react';
export function AuthScreen({auth,error,onSignedIn}:{auth:SupabaseClient;error:string;onSignedIn:()=>Promise<void>}){
 const [mode,setMode]=useState<'signin'|'signup'>('signin'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState('');
 return <main className="login"><div className="login-card"><div className="brand-icon"><Package/></div><h1>Regenesys</h1><p>{mode==='signup'?'Create your own account':'Welcome back'}</p><small>Private demo workspace · simulated demo</small>{mode==='signup'&&<p className="signup-access-note">Confirm your email to get your own private demo shipments, recordings and activity.</p>}{(failure||error)&&<div role="alert" className="error">{failure||error}</div>}{message&&<p role="status">{message}</p>}
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setFailure('');setMessage('');try{
  if(mode==='signup'){const {data,error}=await auth.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)throw error;setMessage('If registration is available, check your email for confirmation. After confirming your email, sign in to open your private demo workspace.');setPassword('');if(data.session)await onSignedIn();}
  else{const {error}=await auth.auth.signInWithPassword({email,password});if(error)throw error;setPassword('');await onSignedIn();}
 }catch(e){setFailure((e as Error).message);}finally{setBusy(false);}}}>
 <label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?10:undefined} value={password} onChange={e=>setPassword(e.target.value)} required/></label>{mode==='signup'&&<small>Use at least 10 characters. Never share another person’s login.</small>}<button className="primary" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':'Sign in'}</button></form>
 <div className="auth-links"><button className="text-btn" disabled={busy} onClick={()=>{setMode(mode==='signin'?'signup':'signin');setFailure('');setMessage('');setPassword('');}}>{mode==='signin'?'Create an account':'Already have an account? Sign in'}</button><button className="text-btn" disabled={busy} onClick={async()=>{await auth.auth.signOut();setPassword('');setMessage('Signed out. You can use your own account.');}}>Use another account</button></div>
 </div></main>;
}
