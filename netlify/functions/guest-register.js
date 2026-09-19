import {getState,putState} from "./public-state.js";
import {reconcile,registrationClosed} from "./registration-rules.js";
export default async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const {name}=await req.json(),n=String(name||"").trim();
 if(!n)return Response.json({error:"Guest name is required"},{status:400});
 const {db,state}=await getState();
 if(registrationClosed(state.game))return Response.json({error:"Registration is closed"},{status:409});
 state.guestRecords ||= [];
 if(state.guestRecords.some(g=>String(g.name).toLowerCase()===n.toLowerCase()))return Response.json({error:"This guest is already registered"},{status:409});
 reconcile(state);
 const members=(state.safrookMembers||[]).filter(m=>m.active!==false);
 const playing=members.filter(m=>state.memberAvailability?.[m.name]!==false&&state.memberAvailability?.[m.name]!=="waiting").length;
 const confirmed=state.guestRecords.filter(g=>g.status==="confirmed").length;
 const status=playing+confirmed<Number(state.game?.capacity||20)?"confirmed":"waiting";
 const now=Date.now();state.guestRecords.push({name:n,status,paid:false,registeredAt:now,queueSince:now,...(status==="confirmed"?{confirmedAt:now}:{})});
 await putState(db,state);return Response.json({ok:true,status,state});
};
export const config={path:"/api/guest-register"};
