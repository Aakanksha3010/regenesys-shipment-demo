import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('confirmed demo signup enrols once, preserving roles and access removal',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated;
   create schema auth; create schema shipment_demo;
   create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, is_anonymous boolean default false, raw_user_meta_data jsonb);
   create table shipment_demo.members(user_id uuid primary key, role text check(role in ('coordinator','viewer')));
   insert into auth.users values ('00000000-0000-0000-0000-000000000001','existing@example.test',now(),false,'{}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261109111859_auto_join_confirmed_demo_accounts.sql',import.meta.url),'utf8'));
  const role=async(n:number)=>(await db.query<{role:string}>('select role from shipment_demo.members where user_id=$1',[`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`])).rows[0]?.role;
  assert.equal(await role(1),'coordinator');
  await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-000000000002','new@example.test',null,false,'{"role":"coordinator"}');`);
  assert.equal(await role(2),undefined,'unconfirmed metadata cannot grant access');
  await db.exec(`update auth.users set email_confirmed_at=now() where id='00000000-0000-0000-0000-000000000002';`);
  assert.equal(await role(2),'coordinator');
  await db.exec(`update shipment_demo.members set role='viewer' where user_id='00000000-0000-0000-0000-000000000002'; update auth.users set email_confirmed_at=now();`);
  assert.equal(await role(2),'viewer','existing viewer is never promoted');
  await db.exec(`delete from shipment_demo.members where user_id='00000000-0000-0000-0000-000000000002'; update auth.users set email_confirmed_at=now();`);
  assert.equal(await role(2),undefined,'removed access does not return on routine updates');
  await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-000000000003','confirmed@example.test',now(),false,'{}'), ('00000000-0000-0000-0000-000000000004','anonymous@example.test',now(),true,'{}');`);
  assert.equal(await role(3),'coordinator'); assert.equal(await role(4),undefined);
  for(const r of ['anon','authenticated']) assert.equal((await db.query<{ok:boolean}>("select has_function_privilege($1,'shipment_demo.join_confirmed_account()','EXECUTE') as ok",[r])).rows[0].ok,false);
 } finally {await db.close();}
});
