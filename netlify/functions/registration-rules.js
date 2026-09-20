// Shared Safrook registration rules. All times use the game's America/New_York timezone.
export function kickoff(game){
 if(!game?.date||!game?.start)return NaN;
 const [y,m,d]=game.date.split('-').map(Number),[hh,mm]=game.start.split(':').map(Number);
 // US Eastern daylight saving boundaries (second Sunday March / first Sunday November).
 const nthSunday=(month,n)=>{const first=new Date(Date.UTC(y,month-1,1)).getUTCDay();return 1+(7-first)%7+7*(n-1)};
 const march=nthSunday(3,2),nov=nthSunday(11,1);
 const daylight=m>3&&m<11 || m===3&&(d>march||d===march&&hh>=3) || m===11&&(d<nov||d===nov&&hh<1);
 return Date.UTC(y,m-1,d,hh+(daylight?4:5),mm);
}
export function deadlinePassed(game,now=Date.now()){
 const start=kickoff(game);return Number.isFinite(start)&&now>=start-(Number(game.priorityHours??2)*3600000);
}
export function registrationClosed(game,now=Date.now()){
 return !game?.registrationOpen || Number.isFinite(kickoff(game))&&now>=kickoff(game);
}
export function reconcile(state,now=Date.now()){
 const members=(state.safrookMembers||[]).filter(m=>m.active!==false);
 const a=state.memberAvailability ||= {};
 const guests=state.guestRecords ||= [];
 const cap=Math.max(1,Number(state.game?.capacity)||20);
 const protectedNow=deadlinePassed(state.game,now);
 const playing=()=>members.filter(m=>a[m.name]!==false&&a[m.name]!=='waiting').length;
 const guestCount=()=>guests.filter(g=>g.status==='confirmed').length;
 // Enforce capacity without cancelling members or protected guests. Move newest eligible
 // confirmed guests to waiting; retain payment and original registration timestamp.
 const excess=playing()+guestCount()-cap;
 if(excess>0){
  const candidates=guests.filter(g=>g.status==='confirmed'&&!g.protectedSpot)
   .sort((x,y)=>(y.confirmedAt??y.registeredAt??0)-(x.confirmedAt??x.registeredAt??0));
  if(candidates.length<excess){
   const error=new Error('Capacity cannot be below confirmed members and protected guests; change attendance or increase capacity first.');
   error.status=409;throw error;
  }
  for(const g of candidates.slice(0,excess)){
   g.status='waiting';g.displacedAt=now;g.queueSince=g.registeredAt??g.queueSince??now;
  }
 }
 let free=Math.max(0,cap-playing()-guestCount());
 const waitingMembers=members.filter(m=>a[m.name]==='waiting').sort((x,y)=>(state.memberWaitSince?.[x.name]||0)-(state.memberWaitSince?.[y.name]||0));
 const waitingGuests=guests.filter(g=>g.status==='waiting').sort((x,y)=>(x.queueSince??x.registeredAt??0)-(y.queueSince??y.registeredAt??0));
 // Before deadline: members first. After deadline: chronological queue across both types.
 const queue=protectedNow?[...waitingMembers.map(m=>({type:'m',m,t:state.memberWaitSince?.[m.name]||now})),...waitingGuests.map(g=>({type:'g',g,t:g.queueSince??g.registeredAt??now}))].sort((x,y)=>x.t-y.t):[...waitingMembers.map(m=>({type:'m',m})),...waitingGuests.map(g=>({type:'g',g}))];
 for(const item of queue){if(!free)break;if(item.type==='m'){a[item.m.name]=true;delete state.memberWaitSince?.[item.m.name]}else{item.g.status='confirmed';item.g.confirmedAt=now;delete item.g.displacedAt}free--}
 return state;
}
export function changeMember(state,name,canPlay,now=Date.now()){
 const a=state.memberAvailability ||= {},guests=state.guestRecords ||= [];
 const members=(state.safrookMembers||[]).filter(m=>m.active!==false);
 const cap=Math.max(1,Number(state.game?.capacity)||20);
 if(!canPlay){a[name]=false;delete state.memberWaitSince?.[name];return reconcile(state,now)}
 if(a[name]===true||a[name]===undefined)return state;
 const occupied=members.filter(m=>a[m.name]!==false&&a[m.name]!=='waiting').length+guests.filter(g=>g.status==='confirmed').length;
 if(occupied<cap){a[name]=true;delete state.memberWaitSince?.[name];return reconcile(state,now)}
 if(!deadlinePassed(state.game,now)){
  const candidates=guests.filter(g=>g.status==='confirmed'&&!g.protectedSpot).sort((x,y)=>(y.confirmedAt??y.registeredAt??0)-(x.confirmedAt??x.registeredAt??0));
  if(candidates.length){const guest=candidates[0];guest.status='waiting';guest.displacedAt=now;
   // Preserve the original registration order, including among previously displaced guests.
   guest.queueSince=guest.registeredAt??guest.queueSince??now;
   a[name]=true;delete state.memberWaitSince?.[name];return state}
 }
 a[name]='waiting';(state.memberWaitSince ||= {})[name]??=now;return state;
}
