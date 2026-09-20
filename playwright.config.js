import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir: './tests', testMatch: '**/*.spec.js', timeout: 30_000,
 use: { baseURL: 'http://127.0.0.1:8765', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
 projects: [{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
 webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1',url:'http://127.0.0.1:8765',reuseExistingServer:!process.env.CI,timeout:15_000},
 reporter: [['list'],['html',{open:'never'}]],
});
