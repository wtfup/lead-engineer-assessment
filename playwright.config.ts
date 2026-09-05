import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',timeout:30000,fullyParallel:false,use:{baseURL:'http://127.0.0.1:4317',headless:true},reporter:'list',webServer:{command:'npm run dev',url:'http://127.0.0.1:4317',reuseExistingServer:process.env.GITHUB_ACTIONS!=='true',timeout:120000}});
