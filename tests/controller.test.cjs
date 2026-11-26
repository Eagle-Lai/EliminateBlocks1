/** Drive the real turn controller and resolver, replacing Cocos rendering and animation time only. */
const assert = require('node:assert/strict');
const Module = require('node:module');
require('tsx/cjs');

const dialogs = [];
let selectedColor = 3;
const manager = {
    open: async key => {
        if (key === 'dialog') return { show: opts => dialogs.push(opts) };
        if (key === 'colorPicker') return { play: async () => selectedColor };
        if (key === 'talentPicker') return { play: async () => null };
        return null;
    },
    close() {},
};
const presentation = {
    'cc': { _decorator: { ccclass: () => type => type, property: () => () => {} }, Component: class {}, Vec3: class {}, sys: {}, instantiate: prefab => prefab, isValid: obj => !!obj && obj.valid !== false },
    '../ui/UIManager': { UIManager: { instance: manager } },
    '../config/ThemeConfig': { THEME: {} },
    '../service/AudioService': { audio: { play() {}, playBgm() {} } },
    '../service/HapticService': { haptic: { light() {}, medium() {} } },
    '../service/AssetService': { assets: {} },
    '../ui/UIView': { UIView: class {} },
    '../ui/LayoutAdapter': {},
    '../utils/Anim': { wait: async () => {} },
};
const load = Module._load;
Module._load = function (name, ...args) {
    if (presentation[name]) return presentation[name];
    if (name.startsWith('../view/') || name === '../fx/BurstPool') return {};
    return load.call(this, name, ...args);
};
const { UIManager } = require('../assets/scripts/ui/UIManager.ts');
const { GameEntry } = require('../assets/scripts/app/GameEntry.ts');
const { GameController } = require('../assets/scripts/controller/GameController.ts');
const { dailyConfig, levelConfig, endlessConfig } = require('../assets/scripts/app/GameMode.ts');
const { LEVELS } = require('../assets/scripts/config/LevelTable.ts');
const { dropYForPose } = require('../assets/scripts/core/CollisionService.ts');
const { ReplayPlayer } = require('../assets/scripts/core/ReplayPlayer.ts');
const { replayStore } = require('../assets/scripts/service/ReplayStore.ts');
const { storage, StorageKey } = require('../assets/scripts/service/StorageService.ts');
Module._load = load;

async function start(config) {
    const game = new GameController();
    game._pool = { play() {} };
    const hud = new Proxy({ setTitle: text => { game.title = text; } }, { get: (view, key) => view[key] ?? (() => {}) });
    game._view = { hud, clearScoreStars() {}, pad: { setEnabled: flag => { game.padEnabled = flag; } } };
    await game.startRun(config);
    return game;
}

async function place(game, rotation, col) {
    for (let n = 0; n < rotation; n++) game.rotate();
    while (game._piece.x !== col) assert.ok(game.tryMove(Math.sign(col - game._piece.x), 0));
    assert.equal(game._piece.rotation, rotation);
    game.hardDrop();
    await new Promise(resolve => setImmediate(resolve));
    assert.notEqual(game._fsm.state, 'resolving');
}

async function main() {
    // Exact initial board, seed, goal and three legal moves of the pre-fix level 112.
    const original112 = {
        ...levelConfig(LEVELS[111]), seed: 886928, goal: { type: 'stone', target: 1 },
        initialBoard: [...Array(15).fill('..........'), 'SS.S......'],
    };
    const stones = await start(original112);
    await place(stones, 0, 4);
    await place(stones, 0, 7);
    await place(stones, 1, 1);
    assert.equal(stones._run.rowsCleared, 1);
    assert.equal(stones._run.stoneCleared, 3);
    assert.equal(stones._run.goal.value, 3);
    assert.equal(stones._run.lockCount, 3);
    assert.equal(stones._fsm.state, 'over');
    assert.equal(stones._piece, null);
    assert.ok(storage.levelProgress().stars[112] >= 1);
    assert.ok(ReplayPlayer.verify(replayStore.latest()));

    const burst = await start(levelConfig(LEVELS[4]));
    burst._run.sugar.bonus(100);
    burst._model.set(15, 1, { type: 2, pid: 901 });
    burst._model.set(14, 1, { type: 3, pid: 902 });
    burst._model.set(15, 2, { type: 2, pid: 903 });
    await burst.tryBurst();
    assert.equal(burst._run.lockCount, 0);
    assert.equal(burst._run.goal.done, true);
    assert.equal(burst._fsm.state, 'over');
    assert.equal(burst._model.get(15, 1).type, 3);
    assert.ok(ReplayPlayer.verify(replayStore.latest()));

    const daily = dailyConfig({
        id: 2, board: [...Array(15).fill('..........'), '111S......'],
        goal: { type: 'color', color: 1, target: 3 }, moveLimit: 1, queue: [{ shape: 0, color: 3 }],
    });
    storage.setJson(StorageKey.Daily, { streak: 4 });
    const last = await start(daily);
    assert.match(last.title, /余 1 步/);
    await place(last, 0, 6);
    assert.match(last.title, /余 0 步/);
    assert.equal(last._fsm.state, 'over');
    assert.equal(dialogs.at(-1).title, '通关成功');
    await last.startRun({ ...daily, goal: { type: 'score', target: 100000 } });
    await place(last, 0, 6);
    assert.equal(dialogs.at(-1).title, '步数用尽');
    assert.equal(last.padEnabled, false);
    await last.startRun(last._config);
    assert.equal(last.padEnabled, true);
    assert.equal(last._run.lockCount, 0);

    const unlimited = await start(endlessConfig(10));
    for (let i = 0; i < 3; i++) {
        unlimited._run.sugar.bonus(100);
        await unlimited.tryBurst();
    }
    assert.deepEqual(unlimited._run.recorder.actions.map(a => a.level), [1, 2, 3]);
    assert.equal(unlimited._fsm.state, 'playing');

    const mirror = await start(levelConfig(LEVELS[20]));
    mirror._piece.cells = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }];
    mirror._piece.x = 0;
    mirror._piece.y = 13;
    mirror._model.set(15, 9, { type: 2, pid: 501 });
    assert.equal(dropYForPose(mirror._model, mirror._piece.cells, 0, 13, mirror._run.mutation), 13);
    mirror.stepDown();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mirror._model.get(15, 9)?.pid, 501);

    const rewind = await start({
        ...endlessConfig(221), mode: 'level', goal: { type: 'rows', target: 8 }, shadow: false,
    });
    rewind._run.talents.mods.undoCharges = 1;
    rewind._run.goal.onRowClear(2);
    rewind._model.set(15, 9, { type: 3, pid: 44, special: 'bomb', specialOrder: 2 });
    const original = rewind._piece.clone();
    const originalPreview = rewind._nextPiece.clone();
    const sourceIndex = rewind._source.capture();
    const beforeRandom = rewind._run.rng.getState();
    const board = rewind._model.clone();
    await place(rewind, 0, 0);
    rewind.undo();
    assert.deepEqual(rewind._model.grid, board.grid);
    assert.deepEqual(rewind._piece.cells, original.cells);
    assert.equal(rewind._piece.pid, original.pid);
    assert.equal(rewind._nextPiece.pid, originalPreview.pid);
    assert.equal(rewind._run.goal.value, 2);
    assert.equal(rewind._run.recorder.actions.length, 0);
    assert.equal(rewind._run.rng.getState(), beforeRandom);
    assert.equal(rewind._source.capture(), sourceIndex);
    assert.equal(rewind._undoUsed, 1);
    await place(rewind, 0, 0);
    assert.equal(rewind._piece.pid, originalPreview.pid);
    assert.ok(ReplayPlayer.verify(rewind._run.recorder.finalize(rewind._score.score)));

    // An unbroken stone column reaches the ceiling while a separate three-cell group clears.
    // Lock 9 is the first frost event in the light tier. The full-meter lock bonus adds 5.
    for (const [target, initialEnergy, score, energy, won] of [
        [95, 100, 95, 100, true], [96, 100, 95, 100, false],
        [90, 0, 90, 10, true], [91, 0, 90, 10, false],
    ]) {
        const frost = await start({
            ...levelConfig(LEVELS[0]), goal: { type: 'score', target },
            initialBoard: [...Array(15).fill('.........S'), '222......S'],
            pieceQueue: [{ shape: 0, color: 1, x: 4 }, { shape: 0, color: 3, x: 3 }],
        });
        frost._run.sugar.bonus(initialEnergy);
        frost._run.lockCount = 8;
        await place(frost, 0, 4);
        assert.equal(frost._run.lockCount, 9);
        assert.equal(frost._score.score, score);
        assert.equal(frost._run.sugar.value, energy);
        assert.equal(frost._fsm.state, 'over');
        assert.equal(frost._run.goal.done, won);
        assert.equal(dialogs.at(-1).title, won ? '通关成功' : '被霜降挤出');
        assert.ok(ReplayPlayer.verify(replayStore.latest()));
        // Compare the whole recorded terminal board, including the actual inserted row on failure.
        assert.deepEqual(ReplayPlayer.renderAt(replayStore.latest(), 1).board.grid, frost._model.grid);
    }

    for (const type of ['stone', 'color']) {
        const bottom = type === 'stone' ? '.........S' : '.........3';
        const shield = await start({
            ...levelConfig(LEVELS[0]), mutations: [],
            goal: { type, color: 3, target: 1 },
            initialBoard: ['.......S..', ...Array(14).fill('..........'), bottom],
            pieceQueue: [{ shape: 0, color: 0, x: 0 }, { shape: 1, color: 2, x: 7 }],
        });
        shield._run.talents.mods.shieldCharges = 1;
        await place(shield, 0, 0);
        assert.equal(shield._run.shieldsUsed, 1, type);
        assert.equal(shield._run.rowsCleared, 0, type);
        assert.equal(shield._run.goal.value, 1, type);
        assert.equal(shield._run.lockCount, 1);
        assert.equal(shield._fsm.state, 'over');
        assert.equal(shield._piece, null);
        assert.ok(ReplayPlayer.verify(replayStore.latest()));
    }

    const protectedRun = await start(endlessConfig(71));
    protectedRun._run.talents.mods.shieldCharges = 1;
    const obstacle = protectedRun._nextPiece;
    const blockCol = obstacle.x + obstacle.cells[0].c;
    protectedRun._model.set(obstacle.cells[0].r, blockCol, { type: 4, pid: 785 });
    protectedRun.spawnNext();
    assert.equal(protectedRun._run.shieldsUsed, 1);
    assert.equal(protectedRun._fsm.state, 'playing');
    assert.equal(protectedRun._model.get(obstacle.cells[0].r + 2, blockCol).pid, 785);

    const pending = await start(endlessConfig(33));
    let resume;
    pending._view.board = { rebuild: () => new Promise(resolve => { resume = resolve; }) };
    const old = pending.lock();
    pending._view.board = undefined;
    await pending.startRun(original112);
    const currentPiece = pending._piece;
    resume();
    await old;
    assert.equal(pending._piece, currentPiece);
    assert.equal(pending._run.lockCount, 0);
    assert.equal(pending._fsm.state, 'playing');
    const hidden = await start(endlessConfig(12));
    hidden.hardDrop();
    hidden._onAppHide();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(hidden._fsm.state, 'paused');
    assert.equal(dialogs.at(-1).title, '已暂停');
    hidden.resume();
    assert.equal(hidden._fsm.state, 'playing');

    const background = new GameController();
    const loads = [];
    presentation['../service/AssetService'].assets.loadSpriteFrameFromBundle =
        () => new Promise(resolve => loads.push(resolve));
    const bg = {};
    background._view = { bg };
    background._config = endlessConfig(1);
    background._setBackground();
    background._config = levelConfig(LEVELS[90]);
    background._setBackground();
    loads[1]('new');
    await Promise.resolve();
    loads[0]('stale');
    await Promise.resolve();
    assert.equal(bg.spriteFrame, 'new');
    background._setBackground();
    background._view = null;
    loads[2]('released');
    await Promise.resolve();
    assert.equal(bg.spriteFrame, 'new');

    const route = new GameEntry();
    route._layout = {};
    const bundleCompletions = [];
    const started = [];
    route._loadBundleSafe = () => new Promise(resolve => bundleCompletions.push(resolve));
    route._openGameScreen = async () => ({
        node: { getComponent: () => ({ boot: opts => started.push(opts.config) }) },
    });
    const toEndless = route._startEndless();
    const toLevel = route._startLevel(1);
    bundleCompletions[1](true);
    await toLevel;
    bundleCompletions[0](true);
    await toEndless;
    assert.deepEqual(started.map(config => config.mode), ['level']);
    assert.equal(started[0].goal.type, 'score');

    // Two level requests both reach the real UI manager before either prefab finishes loading.
    const deferredUi = new UIManager();
    deferredUi.layerScene = { children: [] };
    const viewModule = presentation['../ui/UIManager'].UIManager;
    viewModule.instance = deferredUi;
    const prefabLoads = [];
    presentation['../service/AssetService'].assets.loadPrefab = () => new Promise(resolve => prefabLoads.push(resolve));
    const notices = [];
    deferredUi.toast = async msg => { notices.push(msg); };
    const racing = new GameEntry();
    racing._layout = {};
    racing._loadBundleSafe = async () => true;
    let homes = 0;
    racing._openHome = async () => { homes++; racing._route++; };
    const newGames = [];
    const gameView = { onOpen() {}, onClose() {} };
    const prefab = {
        setParent() {}, setPosition() {}, setSiblingIndex() {}, destroy() {},
        getComponent(type) {
            if (type === GameController) return { boot: opts => newGames.push(opts.config.levelId) };
            if (type?.name === 'UIView') return gameView;
            return null;
        },
    };
    gameView.node = prefab;
    const toOne = racing._startLevel(1);
    await Promise.resolve();
    const toTwo = racing._startLevel(2);
    await Promise.resolve();
    assert.equal(prefabLoads.length, 2);
    prefabLoads[0](prefab);
    await toOne;
    prefabLoads[1](prefab);
    await toTwo;
    assert.equal(homes, 0);
    assert.equal(notices.length, 0);
    assert.deepEqual(newGames, [2]);
    const missingBoard = racing._startLevel(1);
    await Promise.resolve();
    prefabLoads[2](null);
    await missingBoard;
    assert.equal(homes, 1);
    assert.deepEqual(notices, ['棋盘加载失败，请重试']);
    viewModule.instance = manager;

    // Crossing midnight can change the check-in date but cannot change the selected puzzle year.
    const NativeDate = Date;
    let clock = new NativeDate(2026, 11, 31, 23, 59);
    global.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [clock.getTime()])); }
        static now() { return clock.getTime(); }
    };
    try {
        const lastOfYear = dailyConfig({ ...daily, id: 365, board: daily.initialBoard, queue: daily.pieceQueue });
        assert.equal(lastOfYear.dailyYear, 2026);
        const yearEnd = await start(lastOfYear);
        clock = new NativeDate(2027, 0, 1, 0, 1);
        await place(yearEnd, 0, 6);
        assert.equal(replayStore.bestMoves(365, new Date(2026, 11, 31)), 1);
        assert.equal(replayStore.bestMoves(365, new Date()), 0);
        await yearEnd.startRun(lastOfYear);
        await place(yearEnd, 0, 6);
        assert.equal(replayStore.bestMoves(365, new Date()), 0);
        assert.equal(replayStore.streak(new Date()), 0);
    } finally { global.Date = NativeDate; }

    const { puzzleForDay } = require('../assets/scripts/app/DailyRepo.ts');
    const solutions = require('../scripts/gen-content/daily-solutions.json');
    for (let day = 1; day <= 365; day++) {
        const puzzle = puzzleForDay(day);
        const game = await start(dailyConfig(puzzle));
        const moves = solutions[day];
        assert.equal(moves.length, puzzle.solutionLength);
        for (const [index, [rotation, col]] of moves.entries()) {
            const context = 'day ' + day + ', move ' + (index + 1);
            assert.equal(game._fsm.state, 'playing', context);
            assert.equal(game._run.goal.done, false, context);
            assert.equal(game._piece.shapeIndex, puzzle.queue[index].shape, context);
            assert.equal(game._piece.color, puzzle.queue[index].color, context);
            await place(game, rotation, col);
        }
        assert.equal(game._run.goal.done, true, 'day ' + day);
        assert.equal(game._fsm.state, 'over', 'day ' + day);
        assert.equal(dialogs.at(-1).title, '通关成功', 'day ' + day);
        assert.equal(game._run.lockCount, puzzle.solutionLength);
    }
    const { GreedyBot } = require('../assets/scripts/core/Solver.ts');
    const { RunBootstrapper } = require('../assets/scripts/controller/RunBootstrapper.ts');
    for (const level of LEVELS) {
        const config = levelConfig(level);
        const board = RunBootstrapper.buildBoard(config);
        const witness = new GreedyBot(level.seed, { mutationId: level.mutationId, tier: level.tier })
            .play(board, 120, config.goal);
        const context = 'level ' + level.id;
        assert.equal(witness.done, true, context + ' has no winning witness');
        const game = await start(config);
        for (const [index, action] of witness.actions.entries()) {
            assert.equal(game._fsm.state, 'playing', context + ' action ' + index);
            if (action.type === 'lock') await place(game, action.rotation, action.x);
            else {
                selectedColor = action.color;
                assert.equal(game._run.sugar.full, true, context + ' action ' + index);
                await game.tryBurst();
            }
        }
        assert.equal(game._run.goal.done, true, context);
        assert.equal(game._fsm.state, 'over', context);
        assert.equal(game._run.lockCount, witness.steps, context + ' steps');
        assert.equal(game._score.score, witness.score, context + ' score');
        assert.ok(dialogs.at(-1).stars >= 1, context + ' stars');
    }
    console.log('120 个正式关卡种子的见证通过控制器验证，通关步数与分数均一致');
    console.log('365 道每日残局均经控制器旋转、横移与直落，在见证的最后一步通关');
    console.log('控制器回归通过：原第112关三次落子、糖爆立即通关、末步胜负、同模式重试、糖爆三级、镜像阻挡、旧局取消、实录回放');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
