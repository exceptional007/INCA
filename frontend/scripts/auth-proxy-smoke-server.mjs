// Local synthetic routing fixture. Never connects to Supabase, R2, or Google.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
const frontendOrigin='http://127.0.0.1:5186';
const state={loginCookies:0,refreshCookies:0,directProfileRequests:0,authOrigins:[]};
const user={id:'proxy-test',email:'proxy.demo@bit.ac.in',role:{id:'student',code:'STUDENT',name:'Student'},mustChangePassword:false,isActive:true};
const backend=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin',frontendOrigin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 const json=(value,status=200)=>{res.writeHead(status);res.end(JSON.stringify(value));};
 const route=req.url.split('?')[0];
 if(route==='/test-state'){json(state);return;}
 if(route.startsWith('/api/v1/auth/'))state.authOrigins.push(req.headers.origin||null);
 if(route==='/api/v1/auth/login'){
  state.loginCookies++;res.setHeader('Set-Cookie','inca_refresh=synthetic-refresh-one; HttpOnly; SameSite=Lax; Path=/api/v1/auth');json({success:true,data:{accessToken:'synthetic-access-one',user}},201);return;
 }
 if(route==='/api/v1/auth/refresh'){
  if(!req.headers.cookie?.includes('inca_refresh=synthetic-refresh-one')){json({message:'No refresh cookie'},401);return;}
  state.refreshCookies++;res.setHeader('Set-Cookie','inca_refresh=synthetic-refresh-two; HttpOnly; SameSite=Lax; Path=/api/v1/auth');json({success:true,data:{accessToken:'synthetic-access-two',user}});return;
 }
 if(route==='/api/v1/auth/me'){json({success:true,data:{id:user.id,email:user.email,role:'STUDENT',mustChangePassword:false}});return;}
 if(route==='/api/v1/auth/logout'){res.setHeader('Set-Cookie','inca_refresh=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/api/v1/auth');json({success:true});return;}
 if(route==='/api/v1/profile'){
  state.directProfileRequests++;
  if(req.headers.authorization!=='Bearer synthetic-access-two'){json({message:'Expired access'},401);return;}
  json({success:true});return;
 }
 json({message:'Unknown test endpoint'},404);
});
backend.listen(5351,'127.0.0.1');
process.env.VITE_API_URL='http://localhost:5351/api/v1';
process.env.VITE_AUTH_API_URL='/api/v1';
const {createServer}=await import('vite');
const vite=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),server:{host:'127.0.0.1',port:5186,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:5351',changeOrigin:true}}}});
await vite.listen();console.log('Synthetic auth proxy ready: frontend 127.0.0.1:5186, direct API localhost:5351.');
const close=async()=>{await vite.close();backend.close();process.exit(0);};process.on('SIGINT',close);process.on('SIGTERM',close);
