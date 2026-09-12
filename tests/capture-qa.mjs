import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
const screen = page.getByTestId('device-screen');
await screen.waitFor({ state: 'visible' });

const box = await screen.boundingBox();
if (!box || Math.abs(box.width - 393) > 1 || Math.abs(box.height - 852) > 1) {
  throw new Error(`Expected 393x852 screen, got ${box?.width}x${box?.height}`);
}

await screen.screenshot({ path: 'qa-implementation-dark.png' });
await page.getByLabel('Pratinjau peran').selectOption('Admin Daerah');
await page.getByRole('button', { name: 'Gunakan mode terang' }).click();
await screen.screenshot({ path: 'qa-implementation-light.png' });
await browser.close();
