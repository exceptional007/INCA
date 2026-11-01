/** Read local configuration; optional --check authenticates with the Google gateway.
 * Sends no email. Never prints keys or recovery links. */
const fs=require('node:fs'),path=require('node:path'),dotenv=require('dotenv');
const env=dotenv.parse(fs.readFileSync(path.resolve(__dirname,'../.env')));
const required=['PASSWORD_MAIL_API_URL','PASSWORD_MAIL_API_KEY','FRONTEND_URL'];
const missing=required.filter(key=>!env[key]);
console.log(JSON.stringify({provider:env.PASSWORD_MAIL_PROVIDER||'gateway',missing,readyForConnectionCheck:!missing.length}));
if(missing.length){process.exitCode=1;}
else if(process.argv.includes('--check')){
 (async()=>{
  try{
   const endpoint=new URL(env.PASSWORD_MAIL_API_URL);
   if(env.PASSWORD_MAIL_PROVIDER!=='google-apps-script' || endpoint.protocol!=='https:' || endpoint.hostname!=='script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint.pathname))throw Error('configuration');
   const result=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:env.PASSWORD_MAIL_API_KEY,action:'check'}),signal:AbortSignal.timeout(20000)});
   const body=await result.json();
   if(!result.ok||body.success!==true||body.ready!==true)throw Error('gateway');
   console.log('Google gateway authenticated; sending quota available. No email sent.');
  }catch{console.log('Connection check failed. Verify deployment access, script properties, URL, and Google sending quota.');process.exitCode=1;}
 })();
}
