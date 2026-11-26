/** Run against a freshly built web-mobile URL. Uses an isolated Chromium profile. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
require('tsx/cjs');
const { LEVELS } = require('../assets/scripts/config/LevelTable.ts');
const { levelConfig } = require('../assets/scripts/app/GameMode.ts');
const { GreedyBot } = require('../assets/scripts/core/Solver.ts');
const { RunBootstrapper } = require('../assets/scripts/controller/RunBootstrapper.ts');

async function main() {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true,
        args: ['--enable-unsafe-swiftshader', '--no-sandbox'],
    });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 750, height: 1334 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(process.argv[2] || 'http://127.0.0.1:8123/');
        await page.waitForFunction(() => window.cc?.js.getClassByName('UIManager')?.instance?.get('home'), { timeout: 60000 });
        const level = LEVELS.find(item => item.id === 112);
        const config = levelConfig(level);
        const witness = new GreedyBot(level.seed, { mutationId: level.mutationId, tier: level.tier })
            .play(RunBootstrapper.buildBoard(config), 120, config.goal);
        assert.equal(witness.done, true);
        const dailyMoves = require('./gen-content/daily-solutions.json')['330'];
        const results = await page.evaluate(async (witness, dailyMoves) => {
            const component = name => cc.js.getClassByName(name);
            const ui = component('UIManager').instance;
            const entry = cc.director.getScene().getComponentsInChildren(component('GameEntry'))[0];
            const controller = () => ui.get('gameScreen')?.node.getComponent(component('GameController'));
            const results = [];
            const check = (condition, detail) => {
                if (!condition) throw Error(detail);
                results.push(detail);
            };
            const wait = async (predicate, label) => {
                const deadline = Date.now() + 15000;
                while (!predicate()) {
                    if (Date.now() > deadline) throw Error('等待超时 ' + label + ' ' + ui.debugStack());
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            };
            const playing = () => controller()?._fsm.state === 'playing' && controller()._piece;
            const ready = () => wait(playing, 'playing');
            const over = () => wait(() => controller()?._fsm.state === 'over' && ui.get('dialog')?.titleLabel?.string, 'over');
            async function home() { await entry._openHome(); await wait(() => ui.get('home'), 'home'); }

            ui.get('home').levelsBtn.onClick();
            await wait(() => ui.get('chapterMap'), 'chapter');
            ui.get('chapterMap').levelGrid.children[0].getComponent(component('LevelNodeView')).button.onClick();
            await ready();
            check(controller()._config.mode === 'level' && controller()._config.levelId === 1, '章节地图的首关以关卡模式开始');

            await entry._startLevel(112);
            await ready();
            const c = controller();
            for (const action of witness.actions) {
                await ready();
                if (action.type === 'burst') {
                    const releasing = c.tryBurst();
                    await Promise.resolve();
                    ui.get('colorPicker')?._finish(action.color);
                    await releasing;
                    continue;
                }
                for (let i = 0; i < action.rotation; i++) c.rotate();
                while (c._piece.x !== action.x) {
                    if (!c.tryMove(Math.sign(action.x - c._piece.x), 0)) throw Error('横移被阻挡');
                }
                c.hardDrop();
                await wait(() => {
                    const picker = ui.get('talentPicker');
                    if (picker?._resolve) picker.skipBtn.onClick();
                    return playing() || c._fsm.state === 'over';
                }, '落子结算');
            }
            await over();
            check(c._run.goal.done && c._run.lockCount === witness.steps && c._score.score === witness.score && !c._piece,
                '正式第112关按实玩输入消除目标霜石，同一锁结束关卡');
            const save = JSON.parse(localStorage.getItem('tm.level')).data;
            check(save.stars[112] >= 1, '完成非得分目标至少得到一星');
            await new Promise(resolve => setTimeout(resolve, 300));
            ui.get('dialog').primaryBtn.onClick();
            await wait(() => playing() && controller()._config.levelId === 113, 'next level');
            check(controller()._config.mode === 'level' && controller()._run.lockCount === 0, '下一关保持关卡模式并重置步数');

            await entry._startLevel(5);
            await ready();
            const burst = controller();
            burst._model.set(15, 0, { type: 0, pid: 99 });
            burst._run.sugar.bonus(100);
            await burst.tryBurst();
            await over();
            check(burst._run.goal.done && burst._run.lockCount === 0, '糖爆达标立即通关，无需再锁一块');

            await entry._startDaily(330);
            await ready();
            const daily = controller();
            check(daily._config.mode === 'daily' && !daily._model.fullRows().length, '第330题开局没有满行');
            const occupied = () => daily._model.grid.flat().filter(Boolean).length;
            const beforeDrop = occupied();
            daily.hardDrop();
            await ready();
            check(daily._run.lockCount === 1 && occupied() === beforeDrop + 4 && daily._run.goal.value === 0,
                '第330题默认首落仅加入本块四格，消行进度保持为零');
            await daily.startRun(daily._config);
            for (const [rotation, column] of dailyMoves) {
                await ready();
                for (let i = 0; i < rotation; i++) daily.rotate();
                while (daily._piece.x !== column) {
                    if (!daily.tryMove(Math.sign(column - daily._piece.x), 0)) throw Error('残局见证横移被阻挡');
                }
                daily.hardDrop();
            }
            await over();
            check(daily._run.goal.done && daily._run.lockCount === dailyMoves.length, '每日残局重试后按实际参考解通关');
            await home();
            await entry._startEndless();
            await ready();
            const endless = controller();
            // Fixture: permanently block the spawn edge; hard drop leads to defeat.
            for (let step = 0; step < 6; step++) endless.stepDown();
            for (let x = 2; x <= 7; x++) {
                for (let r = 0; r <= 1; r++) endless._model.set(r, x, { type: -1, pid: -1, kind: 'stone' });
            }
            for (let tries = 0; tries < 5 && endless._fsm.state !== 'over'; tries++) {
                endless.hardDrop();
                await wait(() => playing() || endless._fsm.state === 'over', 'spawn edge');
            }
            await over();
            await new Promise(resolve => setTimeout(resolve, 300));
            ui.get('dialog').primaryBtn.onClick();
            await ready();
            check(controller()._config.mode === 'endless' && controller()._view.pad.dropBtn.interactable, '失败重试恢复直落按钮');
            return results;
        }, witness, dailyMoves);
        for (const size of [[390, 844], [1280, 720], [375, 667]]) {
            await page.setViewport({ width: size[0], height: size[1] });
            await page.waitForFunction(([w, h]) => {
                const canvas = document.getElementById('GameCanvas');
                const scene = cc.director.getScene();
                const entry = scene.getComponentsInChildren(cc.js.getClassByName('GameEntry'))[0];
                const game = scene.getComponentsInChildren(cc.js.getClassByName('GameController'))[0];
                const expectH = Math.round(750 * Math.min(2.3, Math.max(1334 / 750, h / w)));
                return entry._layout.height === expectH && game._layout.height === expectH &&
                    (w < h || canvas.clientWidth < canvas.clientHeight);
            }, { timeout: 8000 }, size);
        }
        results.push('同一局在手机、横屏和竖屏间切换，棋盘跟随可视区域');
        await page.evaluate(async () => {
            const realDate = window.Date;
            let shownDate = new realDate(2026, 11, 31, 23, 59);
            window.Date = class extends realDate {
                constructor(...args) { super(...(args.length ? args : [shownDate.getTime()])); }
            };
            try {
                const entry = cc.director.getScene().getComponentsInChildren(cc.js.getClassByName('GameEntry'))[0];
                const ui = cc.js.getClassByName('UIManager').instance;
                await entry._openDaily();
                const panel = ui.get('dailyPanel');
                if (panel.selectedDay !== 365) throw Error('跨年测试没有从12月31日开始');
                shownDate = new realDate(2027, 0, 1, 0, 1);
                const deadline = realDate.now() + 5000;
                while (panel.selectedDay !== 1) {
                    if (realDate.now() > deadline) throw Error('日历没有自动刷新到1月1日');
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                panel.playBtn.onClick();
                while (realDate.now() < deadline + 10000) {
                    const game = ui.get('gameScreen')?.node.getComponent(cc.js.getClassByName('GameController'));
                    if (game?._config?.mode === 'daily') {
                        if (game._config.dailyId !== 1 || game._config.dailyYear !== 2027) throw Error('开题年份或题号错误');
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                throw Error('跨年后未打开每日对局');
            } finally {
                window.Date = realDate;
            }
        });
        results.push('日历跨年停留后，元旦当日题绑定新年');
        for (const result of results) console.log('✓', result);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
