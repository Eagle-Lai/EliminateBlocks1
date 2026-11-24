#!/usr/bin/env node
/**
 * 关键屏幕 × 3 分辨率截图（§16.1 第 9 条）。
 * 前置：npm run serve:build（或任意静态服务器指向 build/web-mobile）。
 * 用法：node scripts/shot-screens.cjs [url]
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT = path.resolve(__dirname, '../docs/screenshots');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWPORTS = [
    { name: '750x1334', w: 750, h: 1334 },
    { name: '375x667', w: 375, h: 667 },
    { name: '1280x720', w: 1280, h: 720 },
];

async function clickDesign(page, dx, dy, designH = 1334) {
    const rect = await page.evaluate(() => {
        const el = document.getElementById('GameCanvas') || document.querySelector('canvas');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    if (!rect) return;
    await page.mouse.click(rect.x + (dx / 750) * rect.w, rect.y + (dy / designH) * rect.h);
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: 'new',
        args: ['--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
    });
    let errors = 0;
    for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        page.on('pageerror', (e) => { errors++; console.log(`[${vp.name}] pageerror`, e.message.slice(0, 160)); });
        await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(6000);
        await page.screenshot({ path: path.join(OUT, `${vp.name}-home.png`) });

        await clickDesign(page, 375, 717);
        await sleep(1400);
        await page.screenshot({ path: path.join(OUT, `${vp.name}-chapter.png`) });
        await clickDesign(page, 375, 300); // 返回地图顶部区域不响应，点第一个关卡
        const pos = await page.evaluate(() => {
            const ui = cc.director.getScene().getChildByName('Canvas').getChildByName('UIRoot');
            const map = ui.getChildByName('Layer_Panel').children.find((n) => n.name === 'ChapterMap');
            if (!map) return null;
            const first = map.getChildByName('LevelGrid').children[0];
            if (!first) return null;
            const wp = first.getWorldPosition();
            const el = document.getElementById('GameCanvas') || document.querySelector('canvas');
            const r = el.getBoundingClientRect();
            return { x: r.left + (wp.x / 750) * r.width, y: r.top + ((1334 - wp.y) / 1334) * r.height };
        });
        if (pos) {
            await page.mouse.click(pos.x, pos.y);
            await sleep(4200);
            await page.screenshot({ path: path.join(OUT, `${vp.name}-level.png`) });
        }
        await page.close();
    }
    await browser.close();
    console.log(`[shot:screens] 完成，输出 ${OUT}，页面错误 ${errors}`);
    if (errors > 0) process.exit(1);
})();
