import { getState,putState } from "./public-state.js";
import {changeMember,registrationClosed} from "./registration-rules.js";
export default async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const {name,pin,canPlay}=await req.json();
 const {db,state}=await getState();
 const member=(state.safrookMembers||[]).find(m=>m.name===name&&m.active!==false);
 if(!member||String(member.pin)!==String(pin))return Response.json({error:"Invalid member or PIN"},{status:401});
 if(registrationClosed(state.game))return Response.json({error:"Registration is closed for this game"},{status:409});
 changeMember(state,name,!!canPlay);
 await putState(db,state);
 return Response.json({ok:true,status:state.memberAvailability[name],state});
};
export const config={path:"/api/member-status"};
