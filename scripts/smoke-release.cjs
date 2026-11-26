#!/usr/bin/env node
/**
 * 上线冒烟（v4 换皮验收）：真实坐标点击驱动全部主流程 + 关键弹窗 + 异常/边界态，覆盖 6 种屏幕。
 *
 *   前置：npm run serve:build（或任意静态服务指向 build/web-mobile）
 *   用法：node scripts/smoke-release.cjs [url] [outDir]
 *
 * 每个视口检查：
 *   - 启动 → 首页；首页/局内/弹窗关键节点全部落在可视画布内（适配越界检测）
 *   - 无尽：← → 旋转 直落 生效；暂停/继续；切后台自动暂停；重开确认；堆顶判负 → 结算 → 返回首页
 *   - 关卡：章节页 → 锁定章节提示 → 第 1 关开局 → 暂停 → 返回首页
 *   - 每日：面板 → 开始挑战 → 暂停 → 返回首页
 *   - 设置：音效开关文案切换、制作名单、返回
 *   - 日历选框、目标和实际开局日期一致；首页无回放入口
 *   - 全程 pageerror / console.error 为 0
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT = path.resolve(process.argv[3] || path.join(__dirname, '../.tmp_shot/release'));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = [
    { name: '750x1334', w: 750, h: 1334, dpr: 1, shots: true },
    { name: 'iphone13-390x844', w: 390, h: 844, dpr: 3, mobile: true, shots: true },
    { name: 'android-360x640', w: 360, h: 640, dpr: 2, mobile: true, shots: true },
    { name: 'tall-360x828', w: 360, h: 828, dpr: 2, mobile: true },
    { name: 'ipad-768x1024', w: 768, h: 1024, dpr: 2, mobile: true, shots: true },
    { name: 'desktop-1280x720', w: 1280, h: 720, dpr: 1, shots: true },
];

/** 注入页面的工具：按节点路径找节点、算屏幕坐标、读状态 */
const HELPERS = `
window.__sm = (() => {
  const cc = window.cc;
  const K = (n) => cc.js.getClassByName(n);
  const UIT = K('cc.UITransform');
  const LBL = K('cc.Label');
  const scene = () => cc.director.getScene();
  const find = (root, name) => {
    if (!root) return null;
    if (root.name === name && root.activeInHierarchy && root.getComponent(UIT)) return root;
    for (const c of root.children) { const r = find(c, name); if (r) return r; }
    return null;
  };
  const byPath = (p) => {
    const parts = p.split('/');
    let cur = find(scene(), parts[0]);
    for (let i = 1; cur && i < parts.length; i++) cur = cur.children.find((c) => c.name === parts[i] && c.activeInHierarchy) || null;
    return cur;
  };
  // 画布节点尺寸 = 可视设计尺寸（GameEntry._syncCanvas 同步）
  const visible = () => { const c = scene().children.find((n) => n.getComponent(K('cc.Canvas'))); const u = c.getComponent(UIT); return { width: u.width, height: u.height }; };
  const rectOf = (node) => {
    const ut = node.getComponent(UIT);
    if (!ut) return null;
    const b = ut.getBoundingBoxToWorld();
    const canvas = document.querySelector('#GameCanvas');
    const cr = canvas.getBoundingClientRect();
    const vis = visible();
    const sx = cr.width / vis.width, sy = cr.height / vis.height;
    return { x: cr.left + b.x * sx, y: cr.bottom - (b.y + b.height) * sy, w: b.width * sx, h: b.height * sy, canvas: { x: cr.left, y: cr.top, w: cr.width, h: cr.height } };
  };
  const ctrl = () => {
    const k = cc.js.getClassByName('GameController');
    let found = null;
    const walk = (n) => { const c = k && n.getComponent(k); if (c) found = c; n.children.forEach(walk); };
    walk(scene());
    return found;
  };
  const ui = () => cc.js.getClassByName('UIManager').instance;
  return {
    rect(p) { const n = byPath(p); return n ? rectOf(n) : null; },
    stack() { const m = ui(); return m ? m.debugStack() : []; },
    state() {
      const c = ctrl();
      if (!c || !c._fsm) return { ok: false };
      return { ok: true, state: c._fsm.state, score: c._score.score, x: c._piece ? c._piece.x : null, y: c._piece ? c._piece.y : null, rot: c._piece ? c._piece.rotation : null };
    },
    label(p) { const n = byPath(p); const l = n && n.getComponent(LBL); return l ? l.string : null; },
    active(p) { return !!byPath(p); },
    hide() { (cc.game || window.cc.game).emit('game_on_hide'); },
    open(key, data) { return ui().open(key, data).then(() => true); },
  };
})();
`;

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: 'new',
        args: ['--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
    });
    const report = [];
    let totalFail = 0;

    for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        const errors = [];
        const fails = [];
        const passes = [];
        page.on('console', (m) => {
            const t = m.text();
            if (/favicon|404 \(File not found\)|Failed to load resource/.test(t)) return;
            if (m.type() === 'error') errors.push(t.slice(0, 200));
        });
        page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message.slice(0, 200)));
        await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });

        const ev = (code) => page.evaluate(code);
        const check = (name, cond, detail = '') => (cond ? passes : fails).push(name + (cond ? '' : ` ✗ ${detail}`));
        const shot = async (name) => {
            const english = await page.evaluate(() => cc.director.getScene()
                .getComponentsInChildren(cc.js.getClassByName('cc.Label'))
                .filter(label => label.node.activeInHierarchy && /[A-Za-z]/.test(label.string))
                .map(label => label.string));
            check(name + ' 可见文案为中文', english.length === 0, english.join(', '));
            if (vp.shots) await page.screenshot({ path: path.join(OUT, `${vp.name}-${name}.png`) });
        };
        const rect = (p) => ev(`__sm.rect(${JSON.stringify(p)})`);
        const tap = async (p, wait = 450) => {
            const r = await rect(p);
            if (!r) { fails.push(`tap ${p} ✗ 节点不存在/未激活`); return false; }
            const x = r.x + r.w / 2, y = r.y + r.h / 2;
            if (vp.mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
            await sleep(wait);
            return true;
        };
        const inside = async (label, paths) => {
            const bad = [];
            for (const p of paths) {
                const r = await rect(p);
                if (!r) { bad.push(`${p}(缺失)`); continue; }
                const c = r.canvas;
                if (r.x < c.x - 1 || r.y < c.y - 1 || r.x + r.w > c.x + c.w + 1 || r.y + r.h > c.y + c.h + 1) bad.push(p);
            }
            check(`${label} 节点全部在画布内`, bad.length === 0, bad.join(', '));
        };
        const state = () => ev('__sm.state()');
        const stack = () => ev('__sm.stack()');
        const waitFor = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(200); } return false; };
        const toHomeFromGame = async () => {
            await tap('HUD/Btn_Pause', 600);
            const ok = await waitFor(async () => (await stack()).includes('popup:dialog'), 3000);
            if (ok) await tap('Dialog/Card/Btn_Secondary', 900);
            return waitFor(async () => (await stack()).includes('panel:home'), 5000);
        };

        try {
            await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.waitForFunction(() => window.cc?.js?.getClassByName('UIManager')?.instance
                ?.debugStack().includes('panel:home'), { timeout: 30000 });
            await page.evaluate(HELPERS);
            check('启动进入首页', (await stack()).includes('panel:home'));
            await sleep(500);
            await inside('首页', ['Home/GameTitle', 'Home/Btn_Endless', 'Home/Btn_Levels', 'Home/Btn_Daily', 'Home/Btn_Settings', 'Home/BestTag', 'Home/CoinTag', 'Home/Hint']);
            await shot('01-home');

            // ── 无尽 ──
            await tap('Home/Btn_Endless', 1600);
            check('无尽开局 playing', (await waitFor(async () => (await state()).state === 'playing', 5000)));
            await inside('局内', ['HUD/Btn_Pause', 'HUD/Btn_Restart', 'HUD/ScoreCard', 'HUD/NextCard', 'Pad/Btn_Left', 'Pad/Btn_Right', 'Pad/Btn_Rotate', 'Pad/Btn_Drop', 'SugarRail/Btn_Burst', 'BoardHost/Frame']);
            let s0 = await state();
            await tap('Pad/Btn_Left', 250);
            let s1 = await state();
            check('← 左移', s1.x === s0.x - 1 || s0.x === 0, `${s0.x}→${s1.x}`);
            await tap('Pad/Btn_Right', 250);
            await tap('Pad/Btn_Right', 250);
            let s2 = await state();
            check('→ 右移', s2.x === s1.x + 2 || s2.x === s1.x + 1, `${s1.x}→${s2.x}`);
            await tap('Pad/Btn_Rotate', 250);
            let s3 = await state();
            check('↻ 旋转', s3.rot !== s2.rot || s3.x !== s2.x, `rot ${s2.rot}→${s3.rot}`);
            await shot('02-play');
            await tap('Pad/Btn_Drop', 700);
            check('直落后生成新块', (await state()).y !== null);

            await tap('HUD/Btn_Pause', 700);
            check('暂停 → paused + 弹窗', (await state()).state === 'paused' && (await stack()).includes('popup:dialog'));
            await shot('03-pause');
            await tap('Dialog/Card/Btn_Primary', 600);
            check('继续 → playing', (await state()).state === 'playing');

            await ev('__sm.hide()');
            await sleep(700);
            check('切后台自动暂停', (await state()).state === 'paused' && (await stack()).includes('popup:dialog'));
            await tap('Dialog/Card/Btn_Primary', 600);

            // 堆顶判负
            let over = false;
            let this_restart_checked = false;
            for (let i = 0; i < 90 && !over; i++) {
                await tap('Pad/Btn_Drop', 330);
                const st = await state();
                if (st.state === 'over') over = true;
                if (i >= 6 && !this_restart_checked && st.score > 0 && st.state === 'playing') {
                    this_restart_checked = true;
                    // 有分数后验证重开确认弹窗
                    await tap('HUD/Btn_Restart', 700);
                    const conf = (await stack()).includes('popup:dialog');
                    check('有分时重开需确认', conf);
                    if (conf) await tap('Dialog/Card/Btn_Secondary', 600);
                }
            }
            check('堆顶判负 → over', over);
            await sleep(900);
            check('结算弹窗', (await stack()).includes('popup:dialog'));
            await inside('结算弹窗', ['Dialog/Card', 'Dialog/Card/Btn_Primary', 'Dialog/Card/Btn_Secondary']);
            await shot('04-over');
            await tap('Dialog/Card/Btn_Secondary', 1200);
            check('结算 → 返回首页', (await waitFor(async () => (await stack()).includes('panel:home'), 5000)));

            // ── 关卡 ──
            await tap('Home/Btn_Levels', 1400);
            check('章节页', (await stack()).includes('panel:chapterMap'));
            await inside('章节页', ['ChapterMap/Title', 'ChapterMap/Tabs', 'ChapterMap/Btn_Back']);
            await shot('05-chapter');
            await tap('ChapterMap/Tabs/Tab_2', 700);
            check('锁定章节不跳转', (await stack()).includes('panel:chapterMap'));
            const firstLevel = await ev(`(() => { const g = __sm.rect('ChapterMap/LevelGrid'); return !!g; })()`);
            check('关卡格渲染', firstLevel);
            // 第 1 关：LevelGrid 的第一个子节点
            const lvRect = await ev(`(() => { const cc = window.cc; const g = (function f(n){ if(n.name==='LevelGrid') return n; for (const c of n.children){ const r=f(c); if(r) return r;} return null; })(cc.director.getScene()); const n = g && g.children[0]; if (!n) return null; const b = n.getComponent(cc.js.getClassByName('cc.UITransform')).getBoundingBoxToWorld(); const cr = document.querySelector('#GameCanvas').getBoundingClientRect(); const cv = cc.director.getScene().children.find((x) => x.getComponent(cc.js.getClassByName('cc.Canvas'))).getComponent(cc.js.getClassByName('cc.UITransform')); const vis = { width: cv.width, height: cv.height }; const sx = cr.width/vis.width, sy = cr.height/vis.height; return { x: cr.left + (b.x + b.width/2)*sx, y: cr.bottom - (b.y + b.height/2)*sy }; })()`);
            if (lvRect) {
                if (vp.mobile) await page.touchscreen.tap(lvRect.x, lvRect.y); else await page.mouse.click(lvRect.x, lvRect.y);
            }
            const lvStarted = await waitFor(async () => ['playing', 'mutationIntro'].includes((await state()).state), 6000);
            check('第 1 关开局', lvStarted, JSON.stringify(await state()));
            if (lvStarted) {
                if ((await state()).state === 'mutationIntro') await tap('MutationIntro/Card/Btn_Skip', 800);
                await inside('关卡局内 HUD', ['HUD/GoalCard', 'HUD/Btn_Pause']);
                await shot('06-level');
                check('关卡 → 暂停 → 首页', await toHomeFromGame());
            }

            // ── 每日 ──
            await tap('Home/Btn_Daily', 1400);
            check('每日面板', (await stack()).includes('panel:dailyPanel'));
            await inside('每日面板', ['DailyPanel/Title', 'DailyPanel/Calendar', 'DailyPanel/Btn_Play', 'DailyPanel/Btn_Back', 'DailyPanel/InfoCard']);
            const selection = () => ev(`(() => {
                const v = cc.js.getClassByName('UIManager').instance.get('dailyPanel');
                const cells = v.calendar.children;
                const selected = cells.filter(n => n.getChildByName('Selected').active);
                return { day: v.selectedDay, today: v._today, node: selected.map(n => n.name).join(','),
                    goal: v.goalLabel.string, status: v.statusLabel.string, count: cells.length };
            })()`);
            const initial = await selection();
            const dayOfMonth = Number(initial.node.replace('Day_', ''));
            check('初始金框落在今天', initial.day === initial.today && dayOfMonth >= 1);
            let expectedDay = initial.day;
            if (dayOfMonth > 1) {
                await tap('DailyPanel/Calendar/Day_1', 250);
                const picked = await selection();
                expectedDay = initial.today - dayOfMonth + 1;
                check('切换日期后只有一处金框', picked.day === expectedDay && picked.node === 'Day_1');
                check('日期与难度中文显示', picked.status.includes('月 1 日') && !/[A-Za-z]/.test(picked.status));
                const other = Math.min(2, dayOfMonth);
                await tap('DailyPanel/Calendar/Day_' + other, 250);
                const second = await selection();
                expectedDay += other - 1;
                check('再次点击同步移动选框', second.day === expectedDay && second.node === 'Day_' + other);
            }
            if (dayOfMonth < initial.count) {
                await tap('DailyPanel/Calendar/Day_' + (dayOfMonth + 1), 200);
                check('未开放日期不能改变选择', (await selection()).day === expectedDay);
            }
            const beforePlay = await selection();
            await shot('07-daily');
            await tap('DailyPanel/Btn_Play', 1800);
            const dStarted = await waitFor(async () => ['playing', 'mutationIntro'].includes((await state()).state), 6000);
            check('每日开局', dStarted);
            if (dStarted) {
                const puzzle = await ev(`(() => {
                    const scene = cc.js.getClassByName('UIManager').instance.get('gameScreen');
                    const c = scene.node.getComponent(cc.js.getClassByName('GameController'));
                    return { id: c._config.dailyId, target: c._config.goal.target };
                })()`);
                check('选框、目标卡和实际开局题目一致', puzzle.id === expectedDay && beforePlay.goal.includes(String(puzzle.target)));
                if ((await state()).state === 'mutationIntro') await tap('MutationIntro/Card/Btn_Skip', 800);
                check('每日 → 暂停 → 首页', await toHomeFromGame());
            }

            // ── 设置 ──
            await tap('Home/Btn_Settings', 900);
            check('设置弹窗', (await stack()).includes('popup:settings'));
            const before = await ev(`__sm.label('Settings/Card/Btn_Mute/Label')`);
            await tap('Settings/Card/Btn_Mute', 500);
            const after = await ev(`__sm.label('Settings/Card/Btn_Mute/Label')`);
            check('音效开关文案切换', before !== after, `${before} → ${after}`);
            await tap('Settings/Card/Btn_Mute', 500);
            await tap('Settings/Card/Btn_Credits', 500);
            await shot('08-settings');
            await tap('Settings/Card/Btn_Back', 700);
            check('设置关闭', !(await stack()).includes('popup:settings'));

            check('有历史对局时首页也不显示回放入口', !(await ev("__sm.active('Home/Btn_Replay')")));

            // ── 弹窗兜底渲染（局外打开）──
            await ev(`__sm.open('toast')`);
            await sleep(200);
            check('无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));
        } catch (err) {
            fails.push('异常中断 ✗ ' + String(err).slice(0, 200));
        }
        totalFail += fails.length;
        report.push({ vp: vp.name, pass: passes.length, fail: fails, errors: errors.slice(0, 5) });
        console.log(`\n[${vp.name}] 通过 ${passes.length} 项，失败 ${fails.length} 项`);
        for (const f of fails) console.log('   ✗ ' + f);
        await page.close();
    }
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`\n[smoke:release] ${totalFail === 0 ? 'OK' : 'FAILED'}：${VIEWPORTS.length} 个视口，失败 ${totalFail} 项；截图/报告 → ${OUT}`);
    process.exit(totalFail === 0 ? 0 : 1);
})();
