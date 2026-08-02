import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let dialogShown = false;
  let dialogMessage = '';

  page.on('dialog', async dialog => {
    dialogShown = true;
    dialogMessage = dialog.message();
    console.log(`✓ Dialog appeared: "${dialog.message()}"`);
    await dialog.dismiss(); // Click Cancel
  });

  await page.goto('http://frontend:5173/admin');
  await page.waitForLoadState('networkidle');

  const removeBtn = page.locator('button:has-text("Remove")').first();
  const exists = await removeBtn.count();

  if (exists === 0) {
    console.log('No Remove button found');
  } else {
    await removeBtn.scrollIntoViewIfNeeded();
    await removeBtn.click();
    await page.waitForTimeout(500);

    if (dialogShown) {
      console.log('✓ CONFIRM DIALOG WORKS');
    } else {
      console.log('✗ NO DIALOG');
    }
  }

  await browser.close();
  process.exit(dialogShown ? 0 : 1);
})();
