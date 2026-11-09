import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentOrigins,requestAllowed,usesSupabase} from '../server/deployment.js';
import {createApp} from '../server/app.js';
test('Vercel defaults to authenticated Supabase when the integration supplies credentials',()=>{
 assert.equal(usesSupabase({VERCEL:'1'}),true);
 assert.equal(usesSupabase({VERCEL:'1',DATA_MODE:'supabase'}),true);
 assert.throws(()=>usesSupabase({VERCEL:'1',DATA_MODE:'local'}),/require Supabase/);
 assert.equal(usesSupabase({}),false);
 assert.equal(usesSupabase({DATA_MODE:'supabase'}),true);
});
test('deployment accepts exact project origins and rejects hostile hosts and origins',()=>{
 const allowed=deploymentOrigins({VERCEL:'1',APP_ORIGIN:'https://demo.example.com',VERCEL_URL:'demo-build.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'demo.vercel.app'},4173);
 assert.equal(requestAllowed('demo.example.com','https://demo.example.com',allowed),true);
 assert.equal(requestAllowed('demo-build.vercel.app',undefined,allowed),true);
 for(const [host,origin] of [['evil.vercel.app',undefined],['demo.vercel.app','https://evil.example'],['localhost:4173',undefined],['demo.vercel.app.evil.example',undefined]])assert.equal(requestAllowed(host,origin,allowed),false);
 assert.throws(()=>deploymentOrigins({VERCEL:'1'},4173),/not configured/);
 assert.throws(()=>deploymentOrigins({VERCEL:'1',APP_ORIGIN:'http://demo.example.com'},4173),/HTTPS/);
});
test('local origin policy stays restricted to loopback',()=>{
 const allowed=deploymentOrigins({},4173);
 assert.equal(requestAllowed('127.0.0.1:4173','http://localhost:4173',allowed),true);
 assert.equal(requestAllowed('demo.vercel.app',undefined,allowed),false);
});
test('serverless deployment refuses simulated local identity before opening storage',async()=>{
 const previous={VERCEL:process.env.VERCEL,DATA_MODE:process.env.DATA_MODE};
 process.env.VERCEL='1';process.env.DATA_MODE='local';
 try{await assert.rejects(createApp(),/require Supabase authentication/);}finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('Vercel temporary-config compilation resolves Node types and emits the API',async()=>{
 const {mkdtemp,writeFile,access,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const root=process.cwd(),temp=await mkdtemp(path.join(tmpdir(),'regenesys-vercel-compile-'));
 try{
  // Vercel's native TypeScript compiler extends the project from a config in /tmp.
  await writeFile(path.join(temp,'tsconfig.json'),JSON.stringify({extends:path.join(root,'tsconfig.json'),compilerOptions:{sourceMap:true,inlineSources:true,noEmit:false,outDir:path.join(temp,'output'),rootDir:root,noCheck:true,rewriteRelativeImportExtensions:true},files:[path.join(root,'api/index.ts')],include:[],exclude:[]}));
  const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project',path.join(temp,'tsconfig.json')],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  await access(path.join(temp,'output/api/index.js'));
 }finally{await rm(temp,{recursive:true,force:true});}
});
