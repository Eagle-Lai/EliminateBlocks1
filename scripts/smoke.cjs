/**
 * 冒烟测试：加载构建产物，模拟点击「直落」，读取游戏内部状态并截图。
 * 运行：node scripts/smoke.cjs [url] [outDir]
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT_DIR = process.argv[3] || path.resolve(__dirname, '../.tmp_shot');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 轮询等待控制器就绪（headless 下首次启动可能 4~6s，固定 sleep 容易误判） */
async function waitForController(page, timeoutMs = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        const st = await readState(page);
        if (st.ok) return st;
        await sleep(300);
    }
    return { ok: false, reason: 'timeout waiting controller' };
}

async function readState(page) {
    return page.evaluate(() => {
        const cc = window.cc;
        const scene = cc && cc.director && cc.director.getScene();
        if (!scene) return { ok: false };
        let ctrl = null;
        const walk = (n) => {
            for (const c of n.components) {
                if (c && c.constructor && c.constructor.name === 'GameController') ctrl = c;
            }
            n.children.forEach(walk);
        };
        walk(scene);
        if (!ctrl) return { ok: false, reason: 'controller not found' };
        return {
            ok: true,
            state: ctrl._fsm.state,
            score: ctrl._score.score,
            level: ctrl._level.level,
            blocks: ctrl._model.blockCount(),
            pieceY: ctrl._piece ? ctrl._piece.y : null,
            hasPiece: !!ctrl._piece,
        };
    });
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: 'new',
        args: ['--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: { width: 750, height: 1334, deviceScaleFactor: 1 },
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (msg) => {
        const t = msg.text();
        if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`[${msg.type()}] ${t}`);
    });
    page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('initial:', JSON.stringify(await waitForController(page)));
    await sleep(600);
    await page.screenshot({ path: path.join(OUT_DIR, 'shot_start.png') });

    // 直落按钮位置（750×1334 设计分辨率下 1:1 映射）
    const dropX = 555;
    const dropY = 1214;
    for (let i = 0; i < 10; i++) {
        await page.mouse.click(dropX, dropY);
        await sleep(520);
    }

    const mid = await readState(page);
    console.log('after 10 drops:', JSON.stringify(mid));
    await page.screenshot({ path: path.join(OUT_DIR, 'shot_play.png') });

    // 一路直落到堆满，验证结算弹窗与判负
    let over = false;
    for (let i = 0; i < 70; i++) {
        await page.mouse.click(dropX, dropY);
        await sleep(430);
        const st = await readState(page);
        if (st.state === 'over') {
            over = true;
            console.log('game over at drop', i + 11, JSON.stringify(st));
            break;
        }
    }
    if (over) {
        await sleep(700);
        await page.screenshot({ path: path.join(OUT_DIR, 'shot_over.png') });
    } else {
        console.log('not over after 80 drops', JSON.stringify(await readState(page)));
    }

    // 拖动 + 轻点旋转：验证触摸没有报错
    await page.mouse.move(375, 900);
    await page.mouse.down();
    await page.mouse.move(435, 900, { steps: 6 });
    await page.mouse.up();
    await sleep(300);
    await page.mouse.click(375, 900);
    await sleep(600);

    console.log('after touch:', JSON.stringify(await readState(page)));
    await page.screenshot({ path: path.join(OUT_DIR, 'shot_touch.png') });

    console.log('--- warnings / errors ---');
    console.log(errors.length ? errors.slice(0, 20).join('\n') : '(none)');

    await browser.close();
})().catch((err) => {
    console.error('SMOKE FAILED', err);
    process.exit(1);
});
