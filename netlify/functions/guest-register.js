import { getState,putState } from "./public-state.js";
export default async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const {name}=await req.json();
 const n=String(name||"").trim();
 if(!n)return Response.json({error:"Guest name is required"},{status:400});
 const {db,state}=await getState();
 if(!state.game?.registrationOpen)return Response.json({error:"Registration is closed"},{status:409});
 state.guestRecords=state.guestRecords||[];
 if(state.guestRecords.some(g=>String(g.name).toLowerCase()===n.toLowerCase()))
   return Response.json({error:"This guest is already registered"},{status:409});
 const members=(state.safrookMembers||[]).filter(m=>m.active!==false);
 const unavailable=Object.values(state.memberAvailability||{}).filter(v=>v===false).length;
 const confirmed=state.guestRecords.filter(g=>g.status==="confirmed").length;
 const capacity=Number(state.game?.capacity)||22;
 const status=(members.length-unavailable+confirmed<capacity)?"confirmed":"waiting";
 state.guestRecords.push({name:n,status,paid:false});
 await putState(db,state);
 return Response.json({ok:true,status,state});
};
export const config={path:"/api/guest-register"};
