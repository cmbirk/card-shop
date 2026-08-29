// Headless visual verify: load the app, drive it, screenshot, capture console errors.
// Usage: node scripts/verify.mjs <url> <out.png> "action;action;..."
//
// Actions (semicolon-separated):
//   goto,<stationId>     jump the camera to a nav station via the dev hook
//   wait,<ms>            pause
//   click,<x>,<y>        mouse click at pixel coords
//   dblclick,<x>,<y>     double-click
//   move,<x>,<y>         hover
//   key,<Key>            press a key
//   clickText,<text>     click the first element containing text (DOM overlay)
//   basket,<id>[,<id>]   add card id(s) to the basket via the dev hook
//   pickup,<id>          pick up a card by id (skips needing exact pixel aim)
//   state                print { nav, inspect, basket } state
//   shot,<path>          screenshot to path
//
// Dev hooks (window.__nav/__inspect/__basket) exist only in `npm run dev`.
// Camera glide is slow under headless SwiftShader — after `goto`, the script
// polls up to ~13s for arrival before continuing.
import { chromium } from 'playwright';

const [url = 'http://localhost:5199', out = 'verify.png', script = ''] = process.argv.slice(2);

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const issues = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') issues.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => issues.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

async function arrive(station) {
  await page.evaluate((s) => window.__nav?.getState().goTo(s), station);
  for (let i = 0; i < 26; i++) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => window.__nav?.getState());
    if (s?.mode === 'station' && s.currentStation === station) return;
  }
}

for (const step of script.split(';').map((s) => s.trim()).filter(Boolean)) {
  const [cmd, ...a] = step.split(',');
  if (cmd === 'goto') await arrive(a[0]);
  else if (cmd === 'wait') await page.waitForTimeout(Number(a[0]));
  else if (cmd === 'click') await page.mouse.click(Number(a[0]), Number(a[1]));
  else if (cmd === 'dblclick') await page.mouse.dblclick(Number(a[0]), Number(a[1]));
  else if (cmd === 'move') await page.mouse.move(Number(a[0]), Number(a[1]));
  else if (cmd === 'key') await page.keyboard.press(a[0]);
  else if (cmd === 'clickText') await page.getByText(a.join(','), { exact: false }).first().click();
  else if (cmd === 'basket') await page.evaluate((ids) => ids.forEach((id) => window.__basket?.getState().add(id)), a);
  else if (cmd === 'adminFlag') await page.evaluate(() => window.__auth?.setState({ isAdmin: true }));
  else if (cmd === 'admin') await page.evaluate(() => { window.__auth?.setState({ isAdmin: true }); window.__ui?.getState().setAdminOpen(true); });
  else if (cmd === 'ask') await page.evaluate((id) => { window.__inspect?.getState().pickUp(id); const t = setInterval(() => { if (window.__inspect?.getState().mode === 'inspecting') { clearInterval(t); window.__dialogue?.getState().askAbout(id); } }, 100); }, a[0]);
  else if (cmd === 'pickup') await page.evaluate((id) => window.__inspect?.getState().pickUp(id), a[0]);
  else if (cmd === 'state') {
    const s = await page.evaluate(() => ({
      nav: { mode: window.__nav?.getState().mode, at: window.__nav?.getState().currentStation },
      inspect: window.__inspect?.getState().mode,
      held: window.__inspect?.getState().heldCardId,
      basket: window.__basket?.getState().items,
      adminOpen: window.__ui?.getState().adminOpen,
      chris: window.__keeper?.getState().pose,
      maya: window.__maya?.getState().line,
    }));
    console.log('STATE', JSON.stringify(s));
  } else if (cmd === 'shot') {
    await page.screenshot({ path: a[0] });
    console.log('SCREENSHOT', a[0]);
  }
}

await page.screenshot({ path: out });
console.log('SCREENSHOT', out);
console.log(issues.length ? 'CONSOLE ISSUES:\n' + issues.slice(0, 20).join('\n') : 'NO CONSOLE ERRORS');
await browser.close();
