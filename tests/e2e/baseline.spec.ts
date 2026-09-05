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
