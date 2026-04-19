const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching puppeteer...');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (error) => logs.push(`[uncaughtException] ${error.message}`));
        page.on('requestfailed', (request) =>
            logs.push(`[requestfailed] ${request.url()} - ${request.failure()?.errorText}`)
        );

        console.log('Navigating to http://localhost:8080/ ...');
        await page.goto('http://localhost:8080/', { waitUntil: 'networkidle0' });

        await page.screenshot({ path: 'public/assets/debug.png' });

        console.log('=== BROWSER LOGS ===');
        logs.forEach((l) => console.log(l));
        console.log('=== END LOGS ===');

        await browser.close();
        console.log('Test complete.');
    } catch (e) {
        console.error('Test failed:', e);
    }
})();
