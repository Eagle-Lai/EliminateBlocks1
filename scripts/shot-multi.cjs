/**
 * 多分辨率截图：验证不同宽高比下的布局与报错。
 * node scripts/shot-multi.cjs
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT = path.resolve(__dirname, '../.tmp_shot');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = [
    { name: 'p750x1334', w: 750, h: 1334 },
    { name: 'p656x900', w: 656, h: 900 },
    { name: 'p375x667', w: 375, h: 667 },
    { name: 'p1280x720', w: 1280, h: 720 },
];

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: 'new',
        args: ['--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
    });
    for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        const logs = [];
        page.on('console', (m) => {
            const t = m.text();
            if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${t}`);
        });
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(2600);
        const info = await page.evaluate(() => {
            const cc = window.cc;
            const scene = cc && cc.director && cc.director.getScene();
            const out = { ok: false };
            if (!scene) return out;
            out.ok = true;
            out.design = cc.view.getDesignResolutionSize();
            out.visible = cc.view.getVisibleSize();
            out.frame = cc.view.getFrameSize();
            const canvas = scene.getChildByName('Canvas');
            const ut = (n) => (n ? n.getComponent('cc.UITransform') : null);
            const cut = ut(canvas);
            out.canvasSize = cut ? { w: cut.width, h: cut.height } : null;
            out.entries = canvas ? canvas.components.map((c) => c.constructor.name) : [];
            const find = (n, name) => {
                let hit = null;
                const walk = (m) => { if (m.name === name) hit = m; m.children.forEach(walk); };
                walk(n);
                return hit;
            };
            const play = canvas ? find(canvas, 'PlayArea') : null;
            const board = play ? play.getChildByName('BoardRoot') : null;
            const but = ut(board);
            out.board = but ? { w: but.width, h: but.height, x: board.position.x } : null;
            out.names = canvas ? canvas.children.map((c) => c.name) : [];
            return out;
        });
        await page.screenshot({ path: path.join(OUT, `${vp.name}.png`) });
        console.log(vp.name, JSON.stringify(info));
        console.log('  logs:', logs.length ? logs.slice(0, 6).join(' | ') : '(none)');
        await page.close();
    }
    await browser.close();
})().catch((e) => {
    console.error('FAILED', e);
    process.exit(1);
});
