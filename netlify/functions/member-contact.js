import {getDatabase} from '@netlify/database';
import crypto from 'node:crypto';
const headers={'cache-control':'no-store, max-age=0'};
function validToken(token){
 const secret=process.env.SAFROOK_ADMIN_SECRET||process.env.SAFROOK_ADMIN_PIN||'';
 if(!secret||!token)return false;
 const minute=Math.floor(Date.now()/60000);
 for(let i=0;i<=30;i++){
  const t=crypto.createHmac('sha256',secret).update(String(minute-i)).digest('hex');
  if(token.length===t.length&&crypto.timingSafeEqual(Buffer.from(token),Buffer.from(t)))return true;
 }
 return false;
}
function clean(c){
 const email=String(c?.email||'').trim().slice(0,254);
 const phone=String(c?.phone||'').replace(/[\s().-]/g,'');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid email');
 if(phone&&!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Use international phone format (+country code and number)');
 if(c?.whatsappOptIn&&!phone)throw Error('Phone required for WhatsApp opt-in');
 return {email,phone,whatsappOptIn:!!c?.whatsappOptIn};
}
export default async(req)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers});
 try{
  const body=await req.json();const action=String(body.action||'');
  const db=getDatabase();
  const admin=action.startsWith('admin');
  if(admin){
   const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/,'');
   if(!validToken(token))return Response.json({error:'Admin authorization required'},{status:401,headers});
  }else{
   const memberRows=await db.sql`SELECT payload FROM app_state WHERE id=${'safrook'}`;
   const member=(memberRows[0]?.payload?.safrookMembers||[]).find(m=>m.name===body.name&&m.active!==false);
   if(!member||String(member.pin)!==String(body.pin))return Response.json({error:'Invalid member or PIN'},{status:401,headers});
  }
  const rows=await db.sql`SELECT payload FROM app_state WHERE id=${'safrook_contacts'}`;
  const contacts=rows[0]?.payload||{};
  if(action==='adminList')return Response.json({contacts},{headers});
  if(action==='selfGet')return Response.json({contact:contacts[body.name]||{}},{headers});
  if(action!=='selfSave'&&action!=='adminSave')return Response.json({error:'Unknown action'},{status:400,headers});
  const name=String(body.name||'').trim();
  const members=await db.sql`SELECT payload FROM app_state WHERE id=${'safrook'}`;
  if(!(members[0]?.payload?.safrookMembers||[]).some(m=>m.name===name&&m.active!==false))return Response.json({error:'Member not found'},{status:404,headers});
  const contact=clean(body.contact);
  if(admin&&body.oldName&&body.oldName!==name)delete contacts[String(body.oldName)];
  contacts[name]=contact;
  await db.sql`INSERT INTO app_state (id,payload,updated_at) VALUES (${'safrook_contacts'},${JSON.stringify(contacts)}::jsonb,NOW()) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()`;
  return Response.json({ok:true,contact},{headers});
 }catch(e){console.error('Safrook contact error',e);return Response.json({error:e.message==='Invalid email'||e.message.startsWith('Use international')||e.message.startsWith('Phone required')?e.message:'Contact could not be saved'},{status:400,headers})}
};
export const config={path:'/api/member-contact'};
