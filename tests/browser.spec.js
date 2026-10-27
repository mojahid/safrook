import {test,expect} from '@playwright/test';
// All API calls are intercepted. These tests NEVER contact Safrook production or a real database.
const base=()=>({game:{title:'Safrook QA Game',date:'2027-09-23',start:'22:00',end:'23:00',location:'QA Field',field:'Indoor',capacity:20,guestFee:15,priorityHours:2,registrationOpen:true},safrookMembers:[{name:'QA Member',pin:'1001',active:true,age:35,rating:2,position:'Defender'}],memberAvailability:{},guestRecords:[],announcements:[],games:[],memberWaitSince:{},gameArchive:[]});
test('guest registration updates dashboard and persists across reload',async({page})=>{
 let state=base();
 await page.route('**/api/state',async route=>{if(route.request().method()==='GET')return route.fulfill({json:state,headers:{'x-safrook-revision':'qa-revision-1'}});state=route.request().postDataJSON();return route.fulfill({json:{ok:true},headers:{'x-safrook-revision':'qa-revision-2'}})});
 await page.route('**/api/guest-register',async route=>{const {name}=route.request().postDataJSON();const status=state.guestRecords.length+1<state.game.capacity?'confirmed':'waiting';state.guestRecords.push({name,status,registeredAt:Date.now()});return route.fulfill({json:{ok:true,status,state}})});
 await page.goto('/');await expect(page.locator('#gameTitle')).toHaveText('Safrook QA Game');
 await page.getByRole('button',{name:/Register to Play/}).click();await page.getByRole('button',{name:'Guest Registration'}).click();await page.locator('#guestName').fill('QA Guest');await page.getByRole('button',{name:'Register Guest'}).click();await expect(page.locator('#guestMsg')).toContainText('confirmed');await expect(page.locator('#guests')).toHaveText('1');
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
