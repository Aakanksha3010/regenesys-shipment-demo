import {test,expect} from '@playwright/test';
// Auth UI API doubles. Actual hosted second-user acceptance is a separate check.
test('signup explains automatic confirmed membership without accepting client roles',async({page})=>{
 await page.route('**/api/config',r=>r.fulfill({json:{mode:'supabase',supabaseUrl:'https://auth.example.test',publishableKey:'test-public-key',scenarios:[],audioHistory:false}}));
 await page.route('**/api/state',r=>r.fulfill({status:401,json:{error:'Sign in to continue.'}}));
 let signup:any;await page.route('https://auth.example.test/auth/v1/signup*',r=>{signup=r.request().postDataJSON();return r.fulfill({json:{id:'synthetic-reviewer',email:'reviewer@example.test',confirmation_sent_at:new Date().toISOString()}});});
 await page.goto('/');await page.getByRole('button',{name:'Create an account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('reviewer@example.test');await page.getByLabel('Password',{exact:true}).fill('Synthetic-test-password-123');await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByText('After confirming your email, sign in to open your private demo workspace.',{exact:false})).toBeVisible();expect(signup.email).toBe('reviewer@example.test');expect(signup.data?.role).toBeUndefined();await expect(page.getByRole('button',{name:'Add shipment',exact:true})).not.toBeVisible();
});
test('signed-in unassigned user stays outside the workspace',async({page})=>{
 await page.route('**/api/config',r=>r.fulfill({json:{mode:'supabase',supabaseUrl:'https://auth.example.test',publishableKey:'test-public-key',scenarios:[],audioHistory:false}}));
 await page.route('**/api/state',r=>r.fulfill({status:401,json:{error:'Your account is waiting for workspace access. Ask the workspace owner to add you.'}}));
 const token=[{alg:'HS256',typ:'JWT'},{sub:'synthetic-outsider',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.test-signature';
 await page.route('https://auth.example.test/auth/v1/token*',r=>r.fulfill({json:{access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'synthetic-refresh-token',user:{id:'synthetic-outsider',email:'outsider@example.test'}}}));
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill('outsider@example.test');await page.getByLabel('Password',{exact:true}).fill('Synthetic-test-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert')).toContainText('waiting for workspace access');await expect(page.getByRole('button',{name:'Add shipment',exact:true})).not.toBeVisible();
});
