export function deploymentOrigins(env:NodeJS.ProcessEnv,port:number):Set<string>{
 if(!env.VERCEL)return new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
 const origins=new Set<string>();
 for(const value of [env.APP_ORIGIN,env.VERCEL_URL&&`https://${env.VERCEL_URL}`,env.VERCEL_PROJECT_PRODUCTION_URL&&`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`]){
  if(!value)continue;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Deployment origin must be an exact HTTPS origin.');
  origins.add(url.origin);
 }
 if(!origins.size)throw Error('Deployment origin is not configured.');
 return origins;
}
export function requestAllowed(host:string|undefined,origin:string|undefined,allowed:Set<string>):boolean{
 if(!host||![...allowed].some(value=>new URL(value).host===host))return false;
 return !origin||allowed.has(origin);
}
