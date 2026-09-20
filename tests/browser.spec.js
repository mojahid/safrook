import {test,expect} from '@playwright/test';
// All API calls are intercepted. These tests NEVER contact Safrook production or a real database.
const base=()=>({game:{title:'Safrook QA Game',date:'2027-09-23',start:'22:00',end:'23:00',location:'QA Field',field:'Indoor',capacity:20,guestFee:15,priorityHours:2,registrationOpen:true},safrookMembers:[{name:'QA Member',pin:'1001',active:true,age:35,rating:2,position:'Defender'}],memberAvailability:{},guestRecords:[],announcements:[],games:[],memberWaitSince:{},gameArchive:[]});
test('guest registration updates dashboard and persists across reload',async({page})=>{
 let state=base();
 await page.route('**/api/state',async route=>{if(route.request().method()==='GET')return route.fulfill({json:state});state=route.request().postDataJSON();return route.fulfill({json:{ok:true}})});
 await page.route('**/api/guest-register',async route=>{const {name}=route.request().postDataJSON();const status=state.guestRecords.length+1<state.game.capacity?'confirmed':'waiting';state.guestRecords.push({name,status,registeredAt:Date.now()});return route.fulfill({json:{ok:true,status,state}})});
 await page.goto('/');await expect(page.locator('#gameTitle')).toHaveText('Safrook QA Game');
 await page.getByRole('button',{name:/Register to Play/}).click();await page.getByRole('button',{name:'Guest Registration'}).click();await page.locator('#guestName').fill('QA Guest');await page.getByRole('button',{name:'Register Guest'}).click();await expect(page.locator('#guestMsg')).toContainText('confirmed');await expect(page.locator('#guests')).toHaveText('1');
 await page.reload();await expect(page.locator('#guests')).toHaveText('1');
});
test('mobile layout shows game and registration',async({page,isMobile})=>{
 test.skip(!isMobile,'mobile project only');const state=base();await page.route('**/api/state',route=>route.fulfill({json:state}));await page.goto('/');await expect(page.locator('#gameTitle')).toBeVisible();await page.getByRole('button',{name:/Register to Play/}).click();await expect(page.getByRole('button',{name:'Guest Registration'})).toBeVisible();
});
