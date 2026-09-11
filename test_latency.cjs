const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting browser...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  console.log("Navigating to http://localhost:5173...");
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    console.log("Page loaded!");

    // Wait for the button to appear
    await page.waitForSelector('button.control-btn.storm', { timeout: 10000 });

    console.log("Clicking Start Blizzard...");
    const startTime = Date.now();
    await page.click('button.control-btn.storm');
    
    // Wait for the button text to change to "Stop Blizzard" or wait for it to not be disabled
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('button.control-btn.storm');
        return btn && btn.textContent.includes('Stop Blizzard');
      },
      { timeout: 10000 }
    );
    const duration = Date.now() - startTime;
    console.log(`Blizzard activation took ${duration}ms`);
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await browser.close();
  }
})();
