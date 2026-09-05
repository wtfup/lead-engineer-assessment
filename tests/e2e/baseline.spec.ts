import {test,expect} from '@playwright/test';
test('working Next page displays synthetic orders and switches account',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Recovery desk'})).toBeVisible();
 await expect(page.locator('tbody tr').first()).toBeVisible();
 await page.getByLabel('Lab account').selectOption('south');
 await expect(page.getByTestId('selected-tenant')).toHaveText('south');
 await expect(page.locator('tbody tr').first()).toBeVisible();
 expect(errors).toEqual([]);
});
test('mobile-width web UI retains controls without page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.getByRole('button',{name:'Run lab worker'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
test('a slow response for a stale tenant must not overwrite the newly selected account',async({page})=>{
 // Delay only the first /api/summary response (north, on initial load) so it resolves after
 // the user has already switched to south. The original page had no guard against this and
 // would render north's numbers under the south selector.
 let firstSummarySeen=false;
 await page.route('**/api/summary',async route=>{
  if(!firstSummarySeen){firstSummarySeen=true;await new Promise(r=>setTimeout(r,800));}
  await route.continue();
 });
 await page.goto('/');
 await page.getByLabel('Lab account').selectOption('south');
 await expect(page.getByTestId('selected-tenant')).toHaveText('south');
 await page.waitForTimeout(1200); // let the delayed, superseded north response resolve
 const summary=await (await page.request.get('/api/summary',{headers:{'x-lab-tenant':'south'}})).json();
 await expect(page.getByTestId('paid-orders')).toHaveText(String(summary.paidOrders));
});
