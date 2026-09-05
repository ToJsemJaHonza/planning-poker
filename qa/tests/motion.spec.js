import { test, expect } from '@playwright/test';

async function alignment(page) {
  return page.locator('[data-figure-placeholder]').evaluateAll(slots => slots.map(el => {
    const id = el.getAttribute('data-figure-placeholder');
    const sprite = document.querySelector(`[data-character-id="player-${id}"]`);
    if (!sprite) return 9999;
    const a = el.getBoundingClientRect(), b = sprite.getBoundingClientRect();
    return Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2);
  }));
}
async function aligned(page) {
  await expect.poll(async () => Math.max(9999 * Number(!(await alignment(page)).length), ...await alignment(page))).toBeLessThan(1);
}
async function controls(page) {
  await page.getByRole('button', { name: 'QA controls', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
});

test('local pixel font actually loads', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some(font => font.family.includes('Press Start 2P') && font.status === 'loaded');
  })).toBe(true);
});

test('detailed figure gallery preserves footprint in every pose alongside PM', async ({ page }, info) => {
  await page.goto('./?app&gallery');
  const figures = page.locator('[data-gallery-figure] > div');
  await expect(figures).toHaveCount(25);
  expect(await figures.evaluateAll(elements => elements.every(el => getComputedStyle(el.firstElementChild).boxShadow !== 'none'))).toBe(true);
  const sizes = () => figures.evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; }));
  expect(await sizes()).toEqual(Array.from({ length: 25 }, () => [60, 70]));
  await page.screenshot({ path: info.outputPath('detailed-characters.png'), fullPage: true });
  const idle = await figures.first().locator('div').first().getAttribute('style');
  for (const state of ['Step 1', 'Step 2', 'Hands on hips', 'Holding card', 'Peeking', 'Stress']) {
    await page.getByRole('button', { name: state, exact: true }).click();
    expect(await sizes()).toEqual(Array.from({ length: 25 }, () => [60, 70]));
    await expect(page.locator('[data-cm-pm-ceremony]')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Idle', exact: true }).click();
  expect(await figures.first().locator('div').first().getAttribute('style')).toBe(idle);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('pixel events: mobile special round fits and animals keep stepping with CSS disabled', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('./?motion=none&count=6');
  await page.getByRole('button', { name: /Split/ }).click();
  const panel = page.locator('[data-special-content]');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  const bounds = await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await expect(panel.getByText('FE / BE', { exact: true })).toBeVisible();
  await expect(page.locator('.pixel-special-panel')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('pixel-special-mobile.png') });
  await expect(panel).toHaveCount(0);
  await controls(page);
  for (const animal of ['Chicken', 'Sheep']) {
    await page.getByRole('button', { name: animal, exact: true }).click();
    await controls(page);
    const body = page.locator('[data-runner-frame]');
    await expect(body).toBeAttached();
    const frame = await body.getAttribute('data-runner-frame');
    await expect.poll(() => body.getAttribute('data-runner-frame')).not.toBe(frame);
    await expect.poll(() => page.locator('[data-pixel-runner]').evaluate(el => el.getBoundingClientRect().x)).toBeGreaterThan(60);
    if (animal === 'Sheep') {
      const bubble = await page.locator('.sheep-text').boundingBox();
      expect(bubble.x).toBeGreaterThanOrEqual(0);
      expect(bubble.x + bubble.width).toBeLessThanOrEqual(320);
    }
    await page.screenshot({ path: info.outputPath(`pixel-${animal.toLowerCase()}-mobile.png`) });
    await expect(body).toHaveCount(0);
    await controls(page);
  }
});

test('ordinary player receives results, can close them, but cannot start a new round', async ({ page }) => {
  await page.goto('./?viewer=1&role=pm&count=6');
  await controls(page);
  await page.getByRole('button', { name: 'Everyone votes', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal from leader', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'New Round', exact: true })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('shame tremble never changes the underlying walking destination', async ({ page }) => {
  await page.goto('./');
  await aligned(page);
  const x = await page.locator('[data-character-id="player-qa-0"]').evaluate(el => el.getBoundingClientRect().x);
  await controls(page);
  await page.getByRole('button', { name: 'Shame stage 5', exact: true }).click();
  const xs = await page.evaluate(() => new Promise(resolve => {
    const values = [], start = performance.now();
    function sample() {
      values.push(document.querySelector('[data-character-id="player-qa-0"]').getBoundingClientRect().x);
      if (performance.now() - start > 1800) resolve(values); else requestAnimationFrame(sample);
    }
    sample();
  }));
  expect(Math.max(...xs.map(value => Math.abs(value - x)))).toBeLessThan(0.5);
});

test('reduced motion: task effects clean up promptly and a lone successor is crowned', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?motion=reduced');
  await page.getByRole('button', { name: '+ Add tasks', exact: true }).click();
  await page.locator('[data-task-title-input]').fill('Quiet task');
  await page.locator('[data-task-row-remove]').click();
  await expect(page.locator('[data-task-magic]')).toHaveCount(0, { timeout: 1000 });
  await page.goto('./?motion=reduced&viewer=1&role=pm&count=2');
  await controls(page);
  await page.getByRole('button', { name: 'Leader leaves', exact: true }).click();
  await expect(page.locator('[data-cm-stage]')).toBeVisible({ timeout: 13000 });
  await expect(page.locator('[data-cm-stage]')).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('[data-cm-crown]')).toHaveCount(1);
  await aligned(page);
});

for (const role of ['pm', 'player']) {
  test(`departing ${role}: real election, continuous PM, one crown, aligned successor`, async ({ page }, info) => {
    await page.goto(`./?viewer=1&role=${role}&count=6`);
    await aligned(page);
    await controls(page);
    await page.getByRole('button', { name: 'Leader leaves', exact: true }).click();
    const stage = page.locator('[data-cm-stage]');
    await expect(stage).toBeVisible({ timeout: 13000 }); // reconnect grace is 10 seconds
    if (role === 'pm') await expect(page.locator('[data-player-tag]')).toHaveCount(5);
    const winner = await stage.getAttribute('data-cm-winner');
    const samples = await page.evaluate(() => new Promise(resolve => {
      const samples = [];
      const started = performance.now();
      function sample() {
        const pm = document.querySelector('[data-character-id="pm"]')?.getBoundingClientRect();
        const stage = document.querySelector('[data-cm-stage]');
        const crowns = [...document.querySelectorAll('[data-cm-crown]')].filter(el => getComputedStyle(el).position === 'fixed');
        if (pm) samples.push({ at: performance.now(), x: pm.x, y: pm.y, phase: stage?.dataset.cmPhase, crowns: crowns.length });
        if (!stage || performance.now() - started > 26000) resolve(samples);
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }));
    await info.attach(`pm-motion-${role}`, { body: JSON.stringify(samples), contentType: 'application/json' });
    expect(new Set(samples.map(s => s.phase))).toContain('crownDelivery');
    expect(Math.max(...samples.map(s => s.crowns))).toBeLessThanOrEqual(1);
    const jumps = samples.slice(1).filter((s, i) => s.at - samples[i].at < 80 && Math.hypot(s.x - samples[i].x, s.y - samples[i].y) > 65);
    expect(jumps.map(s => ({ before: samples[samples.indexOf(s) - 1], after: s })), 'No frame-to-frame PM teleports at ceremony handoffs').toEqual([]);
    await expect(stage).toHaveCount(0);
    await aligned(page);
    await expect(page.locator('[data-cm-crown]')).toHaveCount(1);
    const crown = await page.locator('[data-cm-crown]').boundingBox();
    const successor = await page.locator(`[data-character-id="player-${winner}"]`).boundingBox();
    expect(Math.abs(crown.x - successor.x - 17)).toBeLessThan(1);
    expect(Math.abs(crown.y - successor.y + 22)).toBeLessThan(1);
    await page.screenshot({ path: info.outputPath(`crowned-after-${role}.png`) });
  });
}

test('task editor: materialize, focus, dust and PM gauntlet, save and cancel', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: '+ Add tasks', exact: true }).click();
  await page.locator('[data-task-title-input]').fill('Keep this task');
  await page.getByRole('button', { name: '+ Add row', exact: true }).click();
  await expect(page.locator('[data-task-title-input]').last()).toBeFocused();
  await expect(page.locator('[data-task-magic="add"]')).toBeVisible();
  await page.locator('[data-task-title-input]').last().fill('Turn to dust');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('[data-task-chip]')).toHaveCount(2);
  await page.locator('[data-task-panel-edit-btn]').click();
  await page.locator('[data-task-row-remove]').last().click();
  await expect(page.locator('[data-infinity-gauntlet]')).toBeVisible();
  await expect(page.locator('[data-task-magic="remove"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('task-dust-gauntlet.png') });
  await expect(page.locator('[data-task-chip]')).toHaveCount(2); // draft only
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-task-item]')).toHaveCount(2);
  await page.locator('[data-task-panel-edit-btn]').click();
  await page.locator('[data-task-row-remove]').last().click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('[data-task-chip]')).toHaveCount(1);
  await expect(page.locator('[data-task-magic]')).toHaveCount(0);
  await expect(page.locator('[data-infinity-gauntlet]')).toHaveCount(0);
  await aligned(page);
});

test('desktop: aligned figures, split voting, reveal, keyboard dismissal, new round', async ({ page }, info) => {
  await page.goto('./?count=6');
  await aligned(page);
  await page.getByRole('button', { name: '✂ Split', exact: true }).click();
  await expect(page.locator('[data-split-picker]')).toBeVisible();
  await aligned(page);
  await controls(page);
  await page.getByRole('button', { name: 'Everyone votes' }).click();
  await page.getByRole('button', { name: 'Reveal Cards', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Voting results' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.card-flip-out, .card-flip-in, .card-flip-bounce')).toHaveCount(0);
  await expect(dialog).toContainText('Frontend');
  await expect(dialog).toContainText('Backend');
  await page.screenshot({ path: info.outputPath('split-results.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Show results', exact: true }).click();
  await dialog.getByRole('button', { name: 'New Round', exact: true }).click();
  await expect(page.locator('[data-card-picker]')).toBeVisible();
  await aligned(page);
});

test('320px mobile: all rows reachable, scroll alignment, no horizontal overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('./?count=12');
  await aligned(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('[data-player-tag]').last().scrollIntoViewIfNeeded();
  await aligned(page);
  await expect(page.locator('[data-player-tag]').last()).toBeInViewport();
  await page.screenshot({ path: info.outputPath('mobile-roster.png') });
});

test('opening and closing Tasks does not move the grid or voting controls', async ({ page }) => {
  await page.goto('./?count=6');
  await aligned(page);
  const geometry = () => page.locator('[data-player-grid], [data-phase-bar], [data-card-picker]').evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
  }));
  const before = await geometry();
  await page.getByRole('button', { name: /^Tasks/ }).click();
  expect(await geometry()).toEqual(before);
  await page.getByRole('button', { name: /^Tasks/ }).click();
  expect(await geometry()).toEqual(before);
  await aligned(page);
});

test('resize and manager perspective preserve alignment and footer clearance', async ({ page }) => {
  await page.goto('./?role=pm&count=8');
  await expect(page.locator('[data-card-picker]')).toHaveCount(0);
  await aligned(page);
  await page.setViewportSize({ width: 560, height: 700 });
  await aligned(page);
  await expect.poll(() => page.locator('[data-character-id="pm"]').evaluate(el => {
    const footer = document.querySelector('[data-status-bar]').getBoundingClientRect();
    return el.getBoundingClientRect().bottom <= footer.top;
  })).toBe(true);
  await controls(page);
  await page.getByRole('button', { name: 'Toggle connection' }).click();
  await expect(page.locator('[data-reconnect-banner]')).toBeVisible();
  await expect(page.locator('[data-player-tag]')).toHaveCount(7);
  await page.getByRole('button', { name: 'Toggle connection' }).click();
  await expect(page.locator('[data-reconnect-banner]')).toHaveCount(0);
});

test('reduced motion: new player appears at their slot and votes reveal immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?motion=reduced');
  await controls(page);
  await page.getByRole('button', { name: 'Join guest' }).click();
  await aligned(page);
  await page.getByRole('button', { name: 'Everyone votes' }).click();
  await page.getByRole('button', { name: 'Reveal Cards', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.card-flip-out, .card-flip-in')).toHaveCount(0);
});

test('CSS animations disabled: train moves, hands off a visible player, then settles', async ({ page }) => {
  await page.goto('./?motion=none&count=6');
  await controls(page);
  await page.getByRole('button', { name: 'Train entrance', exact: true }).click();
  const train = page.locator('[data-train-motion]');
  await expect(train).toBeVisible();
  const first = await train.evaluate(el => el.getBoundingClientRect().x);
  await expect.poll(() => train.evaluate(el => el.getBoundingClientRect().x)).not.toBe(first);
  const richard = page.locator('[data-character-id="player-qa-3"]');
  await expect(richard).toBeVisible({ timeout: 10000 });
  const start = await richard.evaluate(el => el.getBoundingClientRect().x);
  await expect.poll(() => richard.evaluate(el => el.getBoundingClientRect().x)).not.toBe(start);
  await expect(train).toHaveCount(0, { timeout: 15000 });
  await aligned(page);
});

test('CSS animations disabled: pipe interpolates and hands off without hiding the player', async ({ page }) => {
  await page.goto('./?motion=none&count=6');
  await controls(page);
  await page.getByRole('button', { name: 'Pipe entrance', exact: true }).click();
  const pipe = page.locator('[data-dbb-pipe-group]');
  const initial = await pipe.getAttribute('style');
  await expect.poll(() => pipe.getAttribute('style')).not.toBe(initial);
  await expect(page.locator('[data-character-id="player-qa-4"]')).toBeVisible({ timeout: 10000 });
  await expect(pipe).toHaveCount(0, { timeout: 15000 });
  await aligned(page);
});

test('name prompt and lobby work when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  await page.goto('./?app');
  await page.getByPlaceholder('Your name...').fill('Tester');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect(page.getByRole('button', { name: /Create/ })).toBeVisible();
});
