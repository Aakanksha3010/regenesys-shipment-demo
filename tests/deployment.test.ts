import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentOrigins,requestAllowed} from '../server/deployment.js';
import {createApp} from '../server/app.js';
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
