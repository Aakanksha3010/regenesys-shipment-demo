import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { seed,transition,type State,type Action,type Actor } from '../src/domain.js';
export const migration=await readFile(new URL('../supabase/migrations/20261105205752_shipment_demo.sql',import.meta.url),'utf8');
export const projectionMigration=await readFile(new URL('../supabase/migrations/20261107090849_complete_demo_projections.sql',import.meta.url),'utf8');
export class Store {
 constructor(public read:()=>Promise<State>, public save:(expected:number,state:State)=>Promise<void>){}
 private tail:Promise<unknown>=Promise.resolve();
 dispatch(action:Action,actor:Actor):Promise<State>{
  const work=this.tail.then(async()=>{for(let i=0;i<3;i++){const current=await this.read();const next=transition(current,action,actor);if(next.version===current.version)return current;try{await this.save(current.version,next);return next;}catch(e){if(i===2||!String(e).includes('VERSION_CONFLICT'))throw e;}}throw Error('Concurrent update; try again.');});
  this.tail=work.catch(()=>{});return work;
 }
}
export async function localStore(path?:string){
 const db=new PGlite(path);
 const exists=await db.query<{exists:boolean}>("select exists(select 1 from pg_namespace where nspname='shipment_demo')");
 if(!exists.rows[0].exists){await db.exec('create role service_role bypassrls; create role anon; create role authenticated;');await db.exec(migration);}
 // This additive migration is idempotent, including for existing local demo stores.
 await db.exec(projectionMigration);
 const read=async()=>{const r=await db.query<{state:State}>('select public.shipment_demo_read() as state');return r.rows[0].state;};
 const save=async(expected:number,state:State)=>{await db.query('select public.shipment_demo_save($1,$2::jsonb)',[expected,JSON.stringify(state)]);};
 if(!await read())await save(-1,seed());
 return {store:new Store(read,save),db};
}
export async function hostedStore(url:string,key:string){
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const read=async()=>{const {data,error}=await client.rpc('shipment_demo_read');if(error)throw Error(error.message);return data as State;};
 const save=async(expected:number,state:State)=>{const {error}=await client.rpc('shipment_demo_save',{p_expected:expected,p_state:state});if(error)throw Error(error.message);};
 if(!await read())await save(-1,seed());
 return {store:new Store(read,save),client};
}
