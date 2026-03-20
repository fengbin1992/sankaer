const { chromium } = require('d:/AINETProject/qp/sankaer/client/node_modules/playwright-core');

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    args: ['--disable-gpu'],
  });

  const page = await browser.newPage();
  const consoleLines = [];

  page.on('console', (msg) => {
    consoleLines.push(`[console:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    consoleLines.push(`[pageerror] ${err.message}`);
  });

  await page.goto('http://127.0.0.1:9000/test.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await page.locator('text=启动全自动测试（5人）').click();

  const startedAt = Date.now();
  const timeoutMs = 120000;
  let finalLog = '';

  while (Date.now() - startedAt < timeoutMs) {
    finalLog = await page.locator('#log').innerText();
    if (finalLog.includes('========= 测试完成 =========')) {
      break;
    }
    await page.waitForTimeout(1000);
  }

  console.log('=== FINAL LOG START ===');
  console.log(finalLog);
  console.log('=== FINAL LOG END ===');
  if (consoleLines.length) {
    console.log('=== CONSOLE START ===');
    console.log(consoleLines.join('\n'));
    console.log('=== CONSOLE END ===');
  }

  const success = finalLog.includes('========= 测试完成 =========');
  await browser.close();
  process.exit(success ? 0 : 2);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
