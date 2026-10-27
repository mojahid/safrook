import {test,expect} from '@playwright/test';
// All API calls are intercepted. These tests NEVER contact Safrook production or a real database.
const base=()=>({game:{title:'Safrook QA Game',date:'2027-09-23',start:'22:00',end:'23:00',location:'QA Field',field:'Indoor',capacity:20,guestFee:15,priorityHours:2,registrationOpen:true},safrookMembers:[{name:'QA Member',pin:'1001',active:true,age:35,rating:2,position:'Defender'}],memberAvailability:{},guestRecords:[],announcements:[],games:[],memberWaitSince:{},gameArchive:[]});
test('guest registration updates dashboard and persists across reload',async({page})=>{
 let state=base();
 await page.route('**/api/state',async route=>{if(route.request().method()==='GET')return route.fulfill({json:state,headers:{'x-safrook-revision':'qa-revision-1'}});state=route.request().postDataJSON();return route.fulfill({json:{ok:true},headers:{'x-safrook-revision':'qa-revision-2'}})});
 await page.route('**/api/guest-register',async route=>{const {name}=route.request().postDataJSON();const status=state.guestRecords.length+1<state.game.capacity?'confirmed':'waiting';state.guestRecords.push({name,status,registeredAt:Date.now()});return route.fulfill({json:{ok:true,status,state}})});
 await page.goto('/');await expect(page.locator('#gameTitle')).toHaveText('Safrook QA Game');
 await page.getByRole('button',{name:/Register to Play/}).click();await page.getByRole('button',{name:'Guest Registration'}).click();await page.locator('#guestName').fill('QA Guest');await page.locator('#guestPosition').selectOption('Midfielder');await page.getByRole('button',{name:'Register Guest'}).click();await expect(page.locator('#guestMsg')).toContainText('confirmed');await expect(page.locator('#guests')).toHaveText('1');
 await page.reload();await expect(page.locator('#guests')).toHaveText('1');
});
test('mobile layout shows game and registration',async({page,isMobile})=>{
 test.skip(!isMobile,'mobile project only');const state=base();await page.route('**/api/state',route=>route.fulfill({json:state,headers:{'x-safrook-revision':'qa-revision-1'}}));await page.goto('/');await expect(page.locator('#gameTitle')).toBeVisible();await page.getByRole('button',{name:/Register to Play/}).click();await expect(page.getByRole('button',{name:'Guest Registration'})).toBeVisible();
});

test('manual assignment and swapping keep published teams unchanged until republish',async({page})=>{
 let state=base();state.safrookMembers=[
 {name:'QA One',pin:'1001',active:true,age:35,rating:3,position:'Defender'},
 {name:'QA Two',pin:'1002',active:true,age:35,rating:3,position:'Midfielder'},
 {name:'QA Three',pin:'1003',active:true,age:35,rating:3,position:'Forward'},
 {name:'QA Four',pin:'1004',active:true,age:35,rating:3,position:'Goalkeeper'}];
 await page.addInitScript(()=>sessionStorage.setItem('safrook_admin_token','qa-token'));
 await page.route('**/api/state',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:state,headers:{'x-safrook-revision':'qa-revision-1'}});
  state=route.request().postDataJSON();return route.fulfill({json:{ok:true},headers:{'x-safrook-revision':'qa-revision-2'}});
 });
 await page.goto('/');
 await expect(page.locator('#gameTitle')).toHaveText('Safrook QA Game');
 await page.evaluate(()=>{
  startManualTeams();
  manualAssignPlayer('QA One',0);manualAssignPlayer('QA Two',0);
  manualAssignPlayer('QA Three',1);manualAssignPlayer('QA Four',1);
 });
 await expect(page.locator('#manualTeamMessage')).toContainText('Draft updated');
 await page.evaluate(()=>publishTeams());
 await expect.poll(()=>page.locator('#publishMsg').textContent()).toContain('Teams published');
 const oldPublished=await page.locator('#publicTeams').textContent();
 await page.evaluate(()=>{
  document.getElementById('swapBlue').value='QA One';
  document.getElementById('swapRed').value='QA Three';
  manualSwapPlayers();
 });
 await expect(page.locator('#manualTeamMessage')).toContainText('swapped');
 expect(await page.locator('#publicTeams').textContent()).toBe(oldPublished);
 await page.evaluate(()=>publishTeams());
 await expect.poll(()=>page.locator('#publishMsg').textContent()).toContain('Teams published');
 expect(await page.locator('#publicTeams').textContent()).not.toBe(oldPublished);
});

test('dragging a player card between Blue and Red changes draft only',async({page,isMobile})=>{
 test.skip(isMobile,'Desktop pointer-drag regression test');
 let state=base();state.safrookMembers=[
 {name:'Drag One',pin:'1001',active:true,age:35,rating:3,position:'Defender'},
 {name:'Drag Two',pin:'1002',active:true,age:35,rating:3,position:'Midfielder'},
 {name:'Drag Three',pin:'1003',active:true,age:35,rating:3,position:'Forward'},
 {name:'Drag Four',pin:'1004',active:true,age:35,rating:3,position:'Goalkeeper'}];
 await page.addInitScript(()=>sessionStorage.setItem('safrook_admin_token','qa-token'));
 await page.route('**/api/state',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:state,headers:{'x-safrook-revision':'qa-revision-1'}});
  state=route.request().postDataJSON();return route.fulfill({json:{ok:true},headers:{'x-safrook-revision':'qa-revision-2'}});
 });
 await page.goto('/');
 await page.evaluate(()=>{show('adminScreen');adminTab('teamsAdmin');startManualTeams();});
 const card=page.locator('.team-player-card[data-player-name="Drag One"]');
 const dest=page.locator('.team-dropzone[data-team-index="0"]');
 await card.scrollIntoViewIfNeeded();await dest.scrollIntoViewIfNeeded();
 const from=await card.boundingBox(),to=await dest.boundingBox();
 expect(from).toBeTruthy();expect(to).toBeTruthy();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
 await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await page.mouse.up();
 console.log('DRAG_DIAGNOSTICS',await page.evaluate(()=>({assigned:generatedTeams.map(t=>t.map(p=>p.name)),teamDrag:!!teamDrag,viewport:[innerWidth,innerHeight],zones:[...document.querySelectorAll('.team-dropzone')].map(z=>({team:z.dataset.teamIndex,rect:[z.getBoundingClientRect().x,z.getBoundingClientRect().y,z.getBoundingClientRect().width,z.getBoundingClientRect().height]}))})));
 await expect(dest.locator('[data-player-name="Drag One"]')).toBeVisible();
 await expect(page.locator('#manualTeamMessage')).toContainText('Draft updated');
});

test('mobile touch pointer moves a player card into Blue draft',async({page,isMobile})=>{
 test.skip(!isMobile,'Mobile project only');
 const state=base();state.safrookMembers=[
  {name:'Touch One',pin:'1001',active:true,age:30,rating:3,position:'Defender'},
  {name:'Touch Two',pin:'1002',active:true,age:30,rating:3,position:'Midfielder'}];
 await page.addInitScript(()=>sessionStorage.setItem('safrook_admin_token','qa-token'));
 await page.route('**/api/state',route=>route.fulfill({json:state,headers:{'x-safrook-revision':'qa-revision-1'}}));
 await page.goto('/');
 await page.evaluate(()=>{show('adminScreen');adminTab('teamsAdmin');startManualTeams();});
 await page.locator('.team-player-card[data-player-name="Touch One"]').scrollIntoViewIfNeeded();
 await page.evaluate(()=>{
  const card=document.querySelector('.team-player-card[data-player-name="Touch One"]');
  const zone=document.querySelector('.team-dropzone[data-team-index="0"]');
  const a=card.getBoundingClientRect(),b=zone.getBoundingClientRect(),id=5;
  const emit=(target,type,x,y)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:type==='pointerup'?0:1}));
  emit(card,'pointerdown',a.left+8,a.top+8);
  emit(window,'pointermove',b.left+b.width/2,b.top+b.height/2);
  emit(window,'pointerup',b.left+b.width/2,b.top+b.height/2);
 });
 await expect(page.locator('.team-dropzone[data-team-index="0"] [data-player-name="Touch One"]')).toBeVisible();
 await expect(page.locator('#manualTeamMessage')).toContainText('Draft updated');
});

test('generated teams are directly draggable without a separate manual section',async({page})=>{
 const state=base();state.safrookMembers=[
  {name:'Inline One',pin:'1001',active:true,age:30,rating:3,position:'Defender'},
  {name:'Inline Two',pin:'1002',active:true,age:30,rating:3,position:'Midfielder'},
  {name:'Inline Three',pin:'1003',active:true,age:30,rating:3,position:'Forward'},
  {name:'Inline Four',pin:'1004',active:true,age:30,rating:3,position:'Goalkeeper'}];
 await page.addInitScript(()=>sessionStorage.setItem('safrook_admin_token','qa-token'));
 await page.route('**/api/state',route=>route.fulfill({json:state,headers:{'x-safrook-revision':'qa-revision-1'}}));
 await page.goto('/');
 await page.evaluate(()=>{show('adminScreen');adminTab('teamsAdmin');generateTeams();});
 await expect(page.locator('#generatedTeams .team-dropzone[data-team-index="0"]')).toBeVisible();
 await expect(page.locator('#generatedTeams .team-dropzone[data-team-index="1"]')).toBeVisible();
 await expect(page.locator('#manualTeamEditor')).toHaveCount(0);
 await expect(page.locator('#generatedTeams .team-player-card')).toHaveCount(4);
 const card=page.locator('#generatedTeams .team-dropzone[data-team-index="0"] .team-player-card').first();
 const name=await card.getAttribute('data-player-name');
 await card.scrollIntoViewIfNeeded();
 const dest=page.locator('#generatedTeams .team-dropzone[data-team-index="1"]');
 await dest.scrollIntoViewIfNeeded();
 const from=await card.boundingBox(),to=await dest.boundingBox();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
 await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await page.mouse.up();
 await expect(dest.locator('.team-player-card[data-player-name="'+name+'"]')).toBeVisible();
 await expect(page.locator('#publicTeams')).toContainText('not available yet');
});

test('unpublish hides member team view, cancel preserves, republish restores without losing draft',async({page})=>{
 let state=base();state.safrookMembers=[
 {name:'Pub One',pin:'1001',active:true,age:35,rating:3,position:'Defender'},
 {name:'Pub Two',pin:'1002',active:true,age:35,rating:3,position:'Forward'}];
 await page.addInitScript(()=>sessionStorage.setItem('safrook_admin_token','qa-token'));
 await page.route('**/api/state',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:state,headers:{'x-safrook-revision':'qa-revision-1'}});
  state=route.request().postDataJSON();return route.fulfill({json:{ok:true},headers:{'x-safrook-revision':'qa-revision-2'}});
 });
 await page.goto('/');
 await page.evaluate(()=>{show('adminScreen');adminTab('teamsAdmin');startManualTeams();manualAssignPlayer('Pub One',0);manualAssignPlayer('Pub Two',1);});
 await page.getByRole('button',{name:'Publish Teams',exact:true}).click();
 await expect(page.locator('#teamVisibilityStatus')).toContainText('visible');
 await expect(page.locator('#publicTeams')).toContainText('Pub One');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Unpublish Teams'}).click();
 await expect(page.locator('#publicTeams')).toContainText('Pub One');
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Unpublish Teams'}).click();
 await expect(page.locator('#publicTeams')).toContainText('not available yet');
 await expect(page.locator('#republishTeamsBtn')).toBeEnabled();
 expect(state.teams.published).toBe(false);
 expect(state.teams.groups.flat().length).toBe(2);
 expect(state.teams.publishedGroups.flat().length).toBe(2);
 await page.reload();
 await expect(page.locator('#publicTeams')).toContainText('not available yet');
 await page.evaluate(()=>{show('adminScreen');adminTab('teamsAdmin');});
 await page.getByRole('button',{name:'Republish Teams'}).click();
 await expect(page.locator('#publicTeams')).toContainText('Pub One');
 expect(state.teams.published).toBe(true);
});
