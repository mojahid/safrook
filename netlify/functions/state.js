import {reconcile} from "./registration-rules.js";
import { getDatabase } from "@netlify/database";
import crypto from "node:crypto";
function validToken(token){
 const secret=process.env.SAFROOK_ADMIN_SECRET||process.env.SAFROOK_ADMIN_PIN||"";
 if(!secret||!token)return false;
 const minute=Math.floor(Date.now()/60000);
 for(let i=0;i<=30;i++){
  const t=crypto.createHmac("sha256",secret).update(String(minute-i)).digest("hex");
  if(token.length===t.length && crypto.timingSafeEqual(Buffer.from(token),Buffer.from(t)))return true;
 }
 return false;
}
const headers={"cache-control":"no-store, max-age=0"};
export default async (req) => {
 try{
  const db=getDatabase();
  if(req.method==="GET"){
   const rows=await db.sql`SELECT payload,updated_at::text AS revision FROM app_state WHERE id=${"safrook"}`;
   return Response.json(rows[0]?.payload||{}, {headers:{...headers,"x-safrook-revision":rows[0]?.revision||"missing"}});
  }
  if(req.method==="POST"){
   const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/,"");
   if(!validToken(token))return Response.json({error:"Admin authorization required"},{status:401,headers});
   const revision=req.headers.get("x-safrook-revision");
   if(!revision)return Response.json({error:"Missing server revision. Refresh and retry; nothing was saved."},{status:428,headers});
   const payload=await req.json();reconcile(payload);
   // Atomic compare-and-swap: an older browser cannot overwrite a newer game.
   const updated=await db.sql`
    UPDATE app_state SET payload=${JSON.stringify(payload)}::jsonb,updated_at=NOW()
    WHERE id=${"safrook"} AND updated_at::text=${revision}
    RETURNING updated_at::text AS revision
   `;
   if(!updated.length)return Response.json({error:"Game changed in another browser. Refresh before making changes; nothing was saved."},{status:409,headers});
   return Response.json({ok:true},{headers:{...headers,"x-safrook-revision":updated[0].revision}});
  }
  return new Response("Method not allowed",{status:405,headers});
 }catch(e){console.error("Safrook state error",e);return Response.json({error:e.status===409?e.message:"Server/database error; no change confirmed."},{status:e.status===409?409:503,headers})}
};
export const config={path:"/api/state"};
