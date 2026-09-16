import { getState,putState } from "./public-state.js";
export default async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const {name,pin,canPlay}=await req.json();
 const {db,state}=await getState();
 const members=state.safrookMembers||[];
 const member=members.find(m=>m.name===name && m.active!==false);
 if(!member || String(member.pin)!==String(pin))return Response.json({error:"Invalid member or PIN"},{status:401});
 state.memberAvailability=state.memberAvailability||{};
 const prev=state.memberAvailability[name];
 const guests=state.guestRecords||[];
 const unavailable=Object.values(state.memberAvailability).filter(v=>v===false).length;
 const totalMembers=members.filter(m=>m.active!==false).length;
 const confirmedGuests=guests.filter(g=>g.status==="confirmed").length;
 const capacity=Number(state.game?.capacity)||22;
 if(canPlay){
   const playingWithoutThis=totalMembers-unavailable-(prev===false?0:1);
   state.memberAvailability[name]=(playingWithoutThis+confirmedGuests>=capacity)?"waiting":true;
 }else{
   state.memberAvailability[name]=false;
   // A freed member spot promotes the first waiting guest.
   const confirmed=guests.filter(g=>g.status==="confirmed").length;
   const unavailableNow=Object.values(state.memberAvailability).filter(v=>v===false).length;
   if(totalMembers-unavailableNow+confirmed<capacity){
     const w=guests.find(g=>g.status==="waiting"); if(w)w.status="confirmed";
   }
 }
 await putState(db,state);
 return Response.json({ok:true,state});
};
export const config={path:"/api/member-status"};
