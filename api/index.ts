import type {IncomingMessage,ServerResponse} from 'node:http';
import {createApp} from '../server/app.js';
let ready:ReturnType<typeof createApp>|undefined;
export default async function handler(req:IncomingMessage,res:ServerResponse){
 try{
  ready??=createApp().catch(error=>{ready=undefined;throw error;});
  const {app}=await ready;
  app(req,res);
 }catch{
  console.error('API initialization failed. Check deployment environment and Supabase availability.');
  res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:'The demo service is temporarily unavailable. Please try again.'}));
 }
}
