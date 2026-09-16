
import crypto from "node:crypto";

const secret = () => process.env.SAFROOK_ADMIN_SECRET || process.env.SAFROOK_ADMIN_PIN || "";

function tokenForMinute(minute) {
  return crypto.createHmac("sha256", secret()).update(String(minute)).digest("hex");
}

export function validAdminToken(token) {
  const minute=Math.floor(Date.now()/60000);
  return [minute,minute-1,minute-2,minute-3,minute-4,minute-5,minute-6,minute-7,minute-8,minute-9,minute-10,
          minute-11,minute-12,minute-13,minute-14,minute-15,minute-16,minute-17,minute-18,minute-19,minute-20,
          minute-21,minute-22,minute-23,minute-24,minute-25,minute-26,minute-27,minute-28,minute-29,minute-30]
    .some(m=>crypto.timingSafeEqual(Buffer.from(token||""),Buffer.from(tokenForMinute(m))));
}

export default async (req) => {
 if(req.method!=="POST") return new Response("Method not allowed",{status:405});
 const {pin}=await req.json();
 const expected=process.env.SAFROOK_ADMIN_PIN;
 if(!expected) return Response.json({error:"Admin PIN not configured"},{status:503});
 if(String(pin)!==String(expected)) return Response.json({error:"Invalid PIN"},{status:401});
 return Response.json({token:tokenForMinute(Math.floor(Date.now()/60000))});
};
export const config={path:"/api/admin-auth"};
