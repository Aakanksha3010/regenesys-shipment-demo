import { createClient } from '@supabase/supabase-js';
import { seed,transition,type State,type Action,type Actor } from '../src/domain.js';
export class Store {
 constructor(public read:()=>Promise<State>, public save:(expected:number,state:State)=>Promise<void>){}
 private tail:Promise<unknown>=Promise.resolve();
 dispatch(action:Action,actor:Actor):Promise<State>{
  const work=this.tail.then(async()=>{for(let i=0;i<3;i++){const current=await this.read();const next=transition(current,action,actor);if(next.version===current.version)return current;try{await this.save(current.version,next);return next;}catch(e){if(i===2||!String(e).includes('VERSION_CONFLICT'))throw e;}}throw Error('Concurrent update; try again.');});
  this.tail=work.catch(()=>{});return work;
 }
}
export async function hostedStore(url:string,key:string){
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const forActor=async(actor:Actor)=>{
  const read=async()=>{const {data,error}=await client.rpc('shipment_account_read',{p_user_id:actor.id});if(error)throw Error('Workspace could not be loaded.');return data as State;};
  const save=async(expected:number,state:State)=>{const {error}=await client.rpc('shipment_account_save',{p_user_id:actor.id,p_expected:expected,p_state:state});if(error)throw Error(error.message);};
  if(!await read()){try{await save(-1,seed());}catch(e){if(!String(e).includes('VERSION_CONFLICT'))throw e;}}
  return new Store(read,save);
 };
 const cleanupState=async()=>{const {data,error}=await client.rpc('shipment_account_audio_audit');if(error)throw Error('Audio cleanup unavailable.');return {...seed(),audit:data} as State;};
 return {forActor,cleanupState,client};
}

export async function localStore(path?:string){return (await import('./local-store.js')).localStore(path);}
