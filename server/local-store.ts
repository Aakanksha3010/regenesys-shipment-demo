import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {Store} from './store.js';
import {seed,type State} from '../src/domain.js';
export const migration=await readFile(new URL('../supabase/migrations/20261105205752_shipment_demo.sql',import.meta.url),'utf8');
export const projectionMigration=await readFile(new URL('../supabase/migrations/20261107090849_complete_demo_projections.sql',import.meta.url),'utf8');
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
