import assert from 'node:assert/strict';
import {localStore} from '../server/store.js';
import type {State} from '../src/domain.js';

// Exercise each accepted domain transition through the actual SQL persistence contract.
// This database is in memory, never the user's local or hosted data.
export async function persistenceContract(){
 const {db,store}=await localStore();let verified=0;
 const projections={contacts:'contacts',shipments:'shipments',checks:'checks',attempts:'attempts',reports:'reports',escalations:'escalations',events:'events',audit:'audit',annotations:'annotations',suppressionEvents:'suppression_events'} as const;
 return {
  close:()=>db.close(),count:()=>verified,
  async verify(before:State,after:State){
   await db.exec('truncate shipment_demo.snapshot, shipment_demo.contacts, shipment_demo.shipments, shipment_demo.checks, shipment_demo.attempts, shipment_demo.reports, shipment_demo.escalations, shipment_demo.events, shipment_demo.audit, shipment_demo.annotations, shipment_demo.suppression_events cascade');
   await store.save(-1,{...before,version:0});
   // Restore the fixture's revision after initializing its relational rows.
   await db.query('update shipment_demo.snapshot set version=$1,state=$2::jsonb where id=true',[before.version,JSON.stringify(before)]);
   if(after.version!==before.version)await store.save(before.version,after);
   // JSON round trip accounts for intentionally omitted undefined optional fields.
   const expected=JSON.parse(JSON.stringify(after)) as State;
   assert.deepEqual(await store.read(),expected,'persisted snapshot');
   for(const [property,table] of Object.entries(projections)){
    const {rows}=await db.query<{data:{id:string}}>('select data from shipment_demo.'+table+' order by id');
    const values=(expected[property as keyof typeof projections] as {id:string}[]).toSorted((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(rows.map(row=>row.data).toSorted((a,b)=>a.id.localeCompare(b.id)),values,table+' projection');
   }
   const reasons=await db.query<{reason:string;attempt_id:string;escalation_id:string}>('select reason,attempt_id,escalation_id from shipment_demo.escalation_reasons order by id');
   assert.equal(reasons.rows.length,expected.escalations.reduce((n,e)=>n+e.reasons.length,0));
   assert.ok(reasons.rows.every(r=>expected.escalations.some(e=>e.id===r.escalation_id&&e.reasons.some(x=>x.reason===r.reason&&x.attemptId===r.attempt_id))));
   verified++;
  }
 };
}
