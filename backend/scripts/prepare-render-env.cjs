/** Writes a Git-ignored Render env import file. Never prints secret values. */
const fs=require('node:fs'),path=require('node:path'),dotenv=require('dotenv');
const root=path.resolve(__dirname,'..');
const flag=process.argv.find(v=>v.startsWith('--frontend-url='));
let frontend;
try{frontend=new URL(flag?.slice('--frontend-url='.length));if(frontend.protocol!=='https:'||frontend.username||frontend.password||frontend.pathname!=='/'||frontend.search||frontend.hash)throw Error();}catch{console.error('Usage: node scripts/prepare-render-env.cjs --frontend-url=https://YOUR-SITE.netlify.app');process.exit(1);}
const local=dotenv.parse(fs.readFileSync(path.join(root,'.env')));
const required=['DATABASE_URL','DIRECT_URL','JWT_SECRET','R2_ACCOUNT_ID','R2_BUCKET_NAME','R2_ACCESS_KEY','R2_SECRET_KEY','PASSWORD_MAIL_API_URL','PASSWORD_MAIL_API_KEY'];
const missing=required.filter(k=>!local[k]);
if(missing.length){console.error('Missing local settings: '+missing.join(', '));process.exit(1);}
const names=[...required,'GEMINI_API_KEY','GEMINI_MODEL'];
const values=Object.fromEntries(names.filter(k=>local[k]).map(k=>[k,local[k]]));
Object.assign(values,{NODE_ENV:'production',NODE_VERSION:'24',FRONTEND_URL:frontend.origin,AUTH_COOKIE_SAME_SITE:'lax',TRUST_PROXY_HOPS:'1',PASSWORD_MAIL_PROVIDER:local.PASSWORD_MAIL_PROVIDER||'google-apps-script'});
const lines=Object.entries(values).map(([key,value])=>{
 const line=key+'="'+value+'"';
 if(/[\r\n]/.test(value)||dotenv.parse(line)[key]!==value)throw Error('Cannot safely serialize '+key+'; enter it directly in Render instead.');
 return line;
});
const folder=path.join(root,'.tmp');fs.mkdirSync(folder,{recursive:true});
fs.writeFileSync(path.join(folder,'render-production.env'),lines.join('\n')+'\n');
console.log('Created backend/.tmp/render-production.env (ignored by Git). Import it into Render only.');
console.log('Update Google Script Property INCA_FRONTEND_URL to '+frontend.origin+'.');
