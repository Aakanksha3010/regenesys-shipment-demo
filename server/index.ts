import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createApp } from './app.js';
const port=Number(process.env.PORT||4173);
const {app}=await createApp();
if(existsSync('dist/index.html')&&process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));}else{const {createServer:createViteServer}=await import('vite');const vite=await createViteServer({server:{middlewareMode:true,hmr:{port:port+100}},appType:'spa'});app.use(vite.middlewares);}
app.listen(port,'127.0.0.1',()=>console.log(`Regenesys demo: http://127.0.0.1:${port} (${process.env.DATA_MODE==='supabase'?'Supabase Auth':'LOCAL · simulated identity'})`));
