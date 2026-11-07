import 'dotenv/config';
import {createClient} from '@supabase/supabase-js';
import {AUDIO_BUCKET} from '../server/audio.js';
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)throw Error('Set server credentials locally first.');
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:existing}=await client.storage.getBucket(AUDIO_BUCKET);
if(existing){if(existing.public)throw Error('Existing bucket is public; refusing to enable audio history.');console.log('Private audio bucket already exists.');}
else{const {error}=await client.storage.createBucket(AUDIO_BUCKET,{public:false,fileSizeLimit:10_000_000,allowedMimeTypes:['audio/webm','audio/mp4','audio/ogg']});if(error)throw Error('Could not create private audio storage: '+error.message);console.log('Created private audio bucket; no browser access policies were added.');}
