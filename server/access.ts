import type {Actor} from '../src/domain.js';
export async function authorize(token:string|undefined,getUser:(token:string)=>Promise<{id:string;email?:string}|null>,getRole:(id:string)=>Promise<unknown>):Promise<Actor>{
 if(!token)throw Error('Sign in to continue.');
 const user=await getUser(token);if(!user)throw Error('Session expired. Sign in again.');
 const role=await getRole(user.id);if(role!=='coordinator'&&role!=='viewer')throw Error('Your account is waiting for workspace access. Ask the workspace owner to add you.');
 return {id:user.id,name:user.email||'Team member',role};
}
