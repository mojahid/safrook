
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

export default async (req) => {
  const db = getDatabase();

  if (req.method === "GET") {
    const rows = await db.sql`SELECT payload FROM app_state WHERE id = ${"safrook"}`;
    return Response.json(rows[0]?.payload || {});
  }

  if (req.method === "POST") {
    const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/,"");
    if(!validToken(token)) return Response.json({error:"Admin authorization required"},{status:401});
    const payload = await req.json();
    await db.sql`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (${"safrook"}, ${JSON.stringify(payload)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/state" };
