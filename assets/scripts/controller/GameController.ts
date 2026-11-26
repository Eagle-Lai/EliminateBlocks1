/**
 * 主控制器：唯一能修改模型的地方。
 * 只做生命周期与编排；结算表现、输入、糖爆、界面分别交给 Presenter / BoardInput / SugarBurst / Prefab 视图。
 */
import {
    _decorator,
    Component,
    EventKeyboard,
    Input,
    KeyCode,
    Node,
    SpriteFrame,
    Vec3,
    instantiate,
    isValid,
    input,
    game,
    Game,
} from 'cc';
import { TUNING } from '../config/GameTuning';
import { rotationCells } from '../core/PieceSource';
import { HighlightView } from '../view/HighlightView';
import { BoardModel } from '../core/BoardModel';
import { PieceModel } from '../core/PieceModel';
import { legalPose, dropYForPose } from '../core/CollisionService';
import { tryRotate } from '../core/Rotator';
import { ScoreService } from '../core/ScoreService';
import { LevelService } from '../core/LevelService';
import type { PieceSource } from '../core/PieceSource';
import type { LayoutInfo } from '../ui/LayoutAdapter';
import { GameScreenView } from '../view/GameScreenView';
import { DialogView } from '../view/DialogView';
import { UIManager } from '../ui/UIManager';
import { BurstPool } from '../fx/BurstPool';
import { audio } from '../service/AudioService';
import { haptic } from '../service/HapticService';
import { storage, StorageKey } from '../service/StorageService';
import { assets } from '../service/AssetService';
import { Logger } from '../utils/Logger';
import { lastLockCell } from '../core/Simulator';
import { FogVision } from '../core/FogVision';
import type { ShadowState } from '../core/ShadowTrack';
import { ColorPickerView } from '../view/ColorPickerView';
import { GameFSM } from '../app/GameFSM';
import { RunContext } from '../app/RunContext';
import { starsFor, type RunConfig } from '../app/GameMode';
import { nav } from '../app/Navigator';
import { RunBootstrapper } from './RunBootstrapper';
import { BoardInput } from './BoardInput';
import { ResolvePresenter } from './ResolvePresenter';
import { SugarBurst } from './SugarBurst';
import { captureUndo, type UndoSnapshot } from './UndoSnapshot';
import { replayStore } from '../service/ReplayStore';
import { MutationIntroView } from '../view/MutationIntroView';

const { ccclass } = _decorator;

export interface GameBootOptions {
    view: GameScreenView;
    layout: LayoutInfo;
    frames: (SpriteFrame | null)[];
    config: RunConfig;
    best: number;
}

@ccclass('GameController')
export class GameController extends Component {
    private _layout!: LayoutInfo;
    private _frames: (SpriteFrame | null)[] = [];
    private _view!: GameScreenView;
    private _config!: RunConfig;
    private _best = 0;
    private _pool!: BurstPool;
    private _presenter!: ResolvePresenter;
    private _sugarBurst!: SugarBurst;
    private _input: BoardInput | null = null;

    private _fsm = new GameFSM();
    private _model!: BoardModel;
    private _score = new ScoreService();
    private _level = new LevelService();
    private _run: RunContext | null = null;
    private _source!: PieceSource;
    private _piece: PieceModel | null = null;
    private _nextPiece: PieceModel | null = null;
    private _dropAcc = 0;
    private _pauseRequested = false;
    private _backgroundRequest = 0;
    private _elapsed = 0;
    private _lastSample = 0;
    private _locking = false;
    private _mirrorColor = 0;
    private _lastMoveSoundAt = 0;
    private _undoSnapshot: UndoSnapshot | null = null;
    private _undoUsed = 0;
    private _undoRun: ReturnType<GameController['_captureRun']> | null = null;
    private _highlightNodes: Node[] = [];


    boot(opts: GameBootOptions): void {
        this._layout = opts.layout;
        this._frames = opts.frames;
        this._view = opts.view;
        this._config = opts.config;
        this._best = opts.best;

        this._model = new BoardModel(TUNING.board.cols, TUNING.board.rows);
        this._pool = new BurstPool(this._view.fxLayer ?? this._view.node);
        void this._pool.preload();

        this._view.board?.init(this._frames);
        this._view.piece?.init(this._frames);
        this.relayout(this._layout);
        this._setBackground();

        this._view.hud?.bind(() => this.requestPause(), () => this.requestRestart());
        this._view.pad?.bind({
            onMove: (dx) => this.tryMove(dx, 0),
            onRotate: () => this.rotate(),
            onDrop: () => this.hardDrop(),
        });
        this._view.sugarRail?.bind(() => void this.tryBurst(), () => this.undo(), () => void this.tryHint());
        this._view.sugarRail?.setHintVisible(!!this._config.hint);

        this._input?.destroy();
        this._input = new BoardInput(this._view.boardHost ?? this.node, this._view.board!, {
            canInput: () => this._fsm.canAcceptInput(),
            gravityDir: () => this._run?.mutation?.dir ?? 1,
            onMove: (dx, dy) => this.tryMove(dx, dy),
            onRotate: () => this.rotate(),
            onTapCell: () => void 0,
        });
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        game.off(Game.EVENT_HIDE, this._onAppHide, this);
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        game.on(Game.EVENT_HIDE, this._onAppHide, this);
        void this.startRun(this._config);
    }

    relayout(layout: LayoutInfo): void {
        this._layout = layout;
        if (!this._view || !this._model) return;
        this._view.board?.layout(this._model.cols, this._model.rows, layout.cell);
        this._view.piece?.layout(layout.cell, layout.boardW, layout.boardH);
        this._view.applyLayout(layout);
        if (this._run) {
            void this._view.board?.rebuild(this._model, 0, this._fogOpts());
            this.syncPiece();
        }
    }

    private _setBackground(): void {
        const request = ++this._backgroundRequest;
        const view = this._view;
        const chapter = this._config.levelId ? Math.ceil(this._config.levelId / 20) : 1;
        const bundle = this._config.mode === 'daily' ? 'daily' : `ch${chapter}`;
        const path = this._config.mode === 'daily' ? 'bg_daily' : `bg_ch${chapter}`;
        assets.loadSpriteFrameFromBundle(bundle, path).then((sf) => {
            if (!sf || request !== this._backgroundRequest || view !== this._view ||
                !isValid(this, true) || !isValid(view, true)) return;
            const background = view.bg;
            if (background && isValid(background, true)) background.spriteFrame = sf;
        });
    }

    async startRun(config: RunConfig = this._config): Promise<void> {
        if (this._run) this._run.cancel();
        this._fsm.force('ready');
        this._input?.cancel();
        this._clearHints();
        this._pauseRequested = false;
        this._config = config;
        this._locking = false;
        const boot = RunBootstrapper.create(config);
        const run = this._run = boot.run;
        if (config.shadow) {
            const saved = storage.getJson<ShadowState | null>(StorageKey.Shadow, null);
            if (saved && Array.isArray(saved.samples) && Number.isFinite(saved.bestScore)) {
                run.shadow.load(saved);
                run.shadowBest = saved.bestScore;
            }
        }
        this._model = boot.model;
        this._source = boot.source;

        this._score.reset();
        this._level.reset();
        this._dropAcc = 0;
        this._elapsed = 0;
        this._lastSample = 0;
        this._undoSnapshot = null;
        this._undoUsed = 0;
        this._undoRun = null;
        this._piece = null;
        this._nextPiece = null;

        this._presenter = new ResolvePresenter(this._view, this._model, this._score, this._level, this._pool);
        this._sugarBurst = new SugarBurst(this._view, this._model, this._score, this._presenter);

        this._view.clearScoreStars();
        this._view.board?.clearAll();
        this._view.piece?.setVisible(false);
        this._view.floats?.clear();
        this._view.banner?.clear();
        this._view.hud?.setScore(0);
        this._view.hud?.setLevel(1);
        this._view.hud?.setProgress(0);
        this._view.hud?.setBest(this._best);
        this._setTitle(run);
        this._view.hud?.setGoal(!!run.goal, run.goal?.text(), run.goal?.progressText());
        this._view.pad?.setEnabled(false);
        this._view.sugarRail?.setUndoEnabled(false);
        this._view.sugarRail?.setHintVisible(!!config.hint);
        if (this._view.shadowBar) this._view.shadowBar.node.active = config.shadow;
        this._view.sugarRail?.setValue(0);
        this._view.sugarRail?.setTalentCount(0);
        this._view.shadowBar?.reset();

        const mutation = this._run.mutation;
        this._view.hud?.setMutationVisible(!!mutation);
        if (mutation) {
            this._fsm.force('mutationIntro');
            this._view.mutationBadge?.setMutation(mutation.def.id, mutation.params.every, 0);
            const intro = await UIManager.instance?.open<MutationIntroView>('mutationIntro');
            if (run.cancelled) return;
            if (intro) {
                audio.play(`mutation_${mutation.def.id}` as never);
                await intro.play(mutation.def.id, mutation.tier);
                if (run.cancelled) return;
                UIManager.instance?.close('mutationIntro');
            }
        }

        await this._view.board?.rebuild(this._model, 0, this._fogOpts());
        if (run.cancelled) return;
        audio.play('start');
        this._nextTurn();
    }

    private _nextTurn(): void {
        this._fsm.force('playing');
        this._view.pad?.setEnabled(true);
        this._locking = false;
        this._dropAcc = 0;
        this.spawnNext();
        if (this._pauseRequested) this.requestPause();
    }

    private _clearHints(): void {
        for (const node of this._highlightNodes) if (node.isValid) node.destroy();
        this._highlightNodes = [];
    }

    private spawnNext(): void {
        const run = this._run;
        if (!run || run.cancelled) return;
        const piece = this._nextPiece ?? this._source.next();
        this._nextPiece = this._source.next();
        if (!piece) {
            this._fail('步数用尽');
            return;
        }
        const dir = run.mutation?.dir ?? 1;
        piece.rotation = 0;
        piece.cells = piece.cells.map((c) => ({ r: c.r, c: c.c }));
        // 出牌源已为无尽/关卡居中，并保留残局指定的初始列。
        piece.y = dir === 1 ? 0 : this._model.rows - 1;
        this._piece = piece;
        this._mirrorColor = run.mutation?.params.independentColor ? run.rng.int(run.config.colorCount) : piece.color;
        run.pieces++;

        const valid = () => legalPose(this._model, piece.cells, piece.x, piece.y, run.mutation);
        if (!valid() && run.shieldsUsed < run.mods.shieldCharges) {
            this._useShield(run, dir);
            run.recorder?.recordFrame(this._model, this._score.score);
            void this._view.board?.rebuild(this._model, 0, this._fogOpts(piece.color));
            if (run.goal?.done) {
                void this._complete(run);
                return;
            }
        }
        if (!valid()) {
            this._piece = null;
            this._view.piece?.setVisible(false);
            this._fail('堆到顶了');
            return;
        }
        if (run.mutation?.fogRows) this._view.board?.setFog(this._model, this._fogOpts(piece.color));
        this._view.hud?.setNext(this._nextPiece, this._frames);
        this.syncPiece();
    }

    private _useShield(run: RunContext, dir: 1 | -1): void {
        run.shieldsUsed++;
        const edge = dir === 1 ? this._model.rows - 1 : 0;
        const rows = [edge, edge - dir];
        for (const row of rows) {
            for (let col = 0; col < this._model.cols; col++) {
                const block = this._model.get(row, col);
                if (block) run.recordCleared([block]);
            }
        }
        this._model.clearRows(rows, dir);
        this._refreshProgress(run);
        this._view.banner?.show('护盾生效', 'level');
    }

    private syncPiece(): void {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run) {
            this._view.piece?.setVisible(false);
            return;
        }
        const dir = run.mutation?.dir ?? 1;
        const ghostY = dropYForPose(this._model, piece.cells, piece.x, piece.y, run.mutation);
        let mirrorX: number | null = null;
        if (run.mutation && run.mutation.mirrors > 0) {
            mirrorX = run.mutation.mirrorOf(piece.cells, piece.x, this._model.cols).x;
        }
        this._view.piece?.sync(piece, ghostY, dir, mirrorX, this._mirrorColor);
    }

    private tryMove(dx: number, dy: number): boolean {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run || !this._fsm.canAcceptInput()) return false;
        if (!legalPose(this._model, piece.cells, piece.x + dx, piece.y + dy, run.mutation)) return false;
        piece.x += dx;
        piece.y += dy;
        this.syncPiece();
        const now = Date.now();
        if (now - this._lastMoveSoundAt > 55) {
            this._lastMoveSoundAt = now;
            audio.play('move', 0.5);
        }
        return true;
    }

    rotate(): void {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run || !this._fsm.canAcceptInput()) return;
        if (tryRotate(piece, this._model, run.mutation?.dir ?? 1, (cells, x, y) => legalPose(this._model, cells, x, y, run.mutation))) {
            this.syncPiece();
            this._view.piece?.playRotate();
            audio.play('rotate');
        }
    }

    hardDrop(): void {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run || !this._fsm.canAcceptInput()) return;
        const targetY = dropYForPose(this._model, piece.cells, piece.x, piece.y, run.mutation);
        if (targetY !== piece.y) {
            this._view.board?.showDropTrail(piece, targetY);
            piece.y = targetY;
            this.syncPiece();
        }
        void this.lock();
    }

    update(dt: number): void {
        if (!this._fsm.canAcceptInput() || !this._piece) return;
        const run = this._run;
        if (!run) return;
        const clamped = Math.min(dt * 1000, TUNING.input.frameClampMs);
        this._dropAcc += clamped;
        this._elapsed += clamped;
        const interval = this._level.dropIntervalMs * run.mods.dropIntervalMul;
        if (this._dropAcc >= interval) {
            this._dropAcc = 0;
            this.stepDown();
        }
        this._tickShadow();
    }

    private _tickShadow(): void {
        const run = this._run;
        if (!run || !run.config.shadow) return;
        if (this._elapsed - this._lastSample < TUNING.shadow.sampleMs) return;
        this._lastSample = this._elapsed;
        run.shadow.sample(this._elapsed, this._score.score);
        if (run.shadow.feed(this._elapsed, this._score.score)) {
            this._view.banner?.show('反超影子！', 'level');
            this._view.shadowBar?.pulse();
            audio.play('shadow_overtake');
            haptic.light();
        }
        const total = Math.max(1, run.shadowBest, this._score.score);
        this._view.shadowBar?.setProgress(this._score.score / total, run.shadow.at(this._elapsed) / total);
    }

    private stepDown(): void {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run) return;
        const dir = run.mutation?.dir ?? 1;
        if (legalPose(this._model, piece.cells, piece.x, piece.y + dir, run.mutation)) {
            piece.y += dir;
            this.syncPiece();
        } else {
            void this.lock();
        }
    }

    private async lock(): Promise<void> {
        const run = this._run;
        const piece = this._piece;
        if (!run || !piece || this._fsm.state !== 'playing' || this._locking) return;
        this._locking = true;
        const dir = run.mutation?.dir ?? 1;
        this._clearHints();
        this._view.sugarRail?.setHintVisible(false);
        if (run.mods.undoCharges > this._undoUsed) {
            this._undoRun = this._captureRun(run, piece);
            this._undoSnapshot = captureUndo(this._model, this._score, this._level, run);
        }
        this._input?.cancel();
        this._view.pad?.setEnabled(false);
        this._fsm.transition('resolving');
        this._piece = null;
        this._view.piece?.setVisible(false);
        this._dropAcc = 0;
        run.lockCount++;
        if (TUNING.rules.gameOverOnLockAboveTop && run.shieldsUsed < run.mods.shieldCharges &&
            piece.cells.some(c => !this._model.inBounds(piece.y + dir * c.r, piece.x + c.c))) {
            this._useShield(run, dir);
            piece.y = dropYForPose(this._model, piece.cells, piece.x, piece.y, run.mutation);
        }
        run.recorder?.recordLock({ shape: piece.shapeIndex, color: piece.color, rotation: piece.rotation, x: piece.x, y: piece.y });

        let overflow = false;
        for (const cell of piece.cells) {
            const r = dir === 1 ? piece.y + cell.r : piece.y - cell.r;
            if (r < 0 || r >= this._model.rows) {
                overflow = true;
                continue;
            }
            this._model.set(r, piece.x + cell.c, { type: piece.color, pid: piece.pid });
        }
        if (run.mutation && run.mutation.mirrors > 0) {
            const mirrored = run.mutation.mirrorOf(piece.cells, piece.x, this._model.cols);
            for (const cell of mirrored.cells) {
                const r = dir === 1 ? piece.y + cell.r : piece.y - cell.r;
                if (r < 0 || r >= this._model.rows) continue;
                if (!this._model.get(r, mirrored.x + cell.c)) {
                    this._model.set(r, mirrored.x + cell.c, { type: this._mirrorColor, pid: -2 * piece.pid - 1 });
                }
            }
        }

        audio.play('lock', 0.7);
        this._view.piece?.playLock();
        try {
            await this._view.board?.rebuild(this._model, 0, this._fogOpts(piece.color));
            if (run.cancelled) return;
            if (overflow && TUNING.rules.gameOverOnLockAboveTop) {
                if (run.goal?.done) await this._complete(run);
                else this._fail(dir === 1 ? '堆到顶了' : '触顶了');
                return;
            }
            await this._settle(run, piece);
            if (!run.cancelled) this._nextTurn();
        } catch (err) {
            if (run.cancelled) return;
            Logger.error('GameController', '结算异常', err);
            this._fail('结算中断，请重试');
        }
    }

    private _setTitle(run: RunContext): void {
        const cfg = run.config;
        const daily = cfg.mode === 'daily';
        const theme = cfg.levelId ? Math.ceil(cfg.levelId / 20) : daily ? 4 : 5;
        const title = daily ? cfg.title + ' · 余 ' + run.movesLeft + ' 步' : cfg.title;
        this._view.hud?.setTitle(title, theme);
    }

    private _refreshProgress(run: RunContext): void {
        if (run.config.mode === 'daily') this._setTitle(run);
        run.goal?.syncScore(this._score.score);
        this._view.hud?.setGoal(!!run.goal, run.goal?.text(), run.goal?.progressText());
        this._view.hud?.setScore(this._score.score);
        this._view.hud?.setProgress(this._level.progress(this._score.score));
        this._view.sugarRail?.setValue(run.sugar.value);
        this._view.sugarRail?.setUndoEnabled(!!this._undoSnapshot, Math.max(0, run.mods.undoCharges - this._undoUsed));
    }

    private async _settle(run: RunContext, piece: PieceModel): Promise<void> {
        const mutation = run.mutation;
        const wasFull = run.sugar.full;
        const anchor = lastLockCell(piece.cells, piece.x, piece.y, mutation?.dir ?? 1);
        this._presenter.prepare(run.config.specials, anchor, piece.color);
        const first = await this._presenter.run(run);
        run.token.throwIfCancelled();
        let removed = first.removedCells;
        let chainSum = first.chainSum;
        const lockBonus = run.config.sugar && wasFull ? TUNING.sugar.lockBonus : 0;
        // 本锁已取得的目标先于随后发生的环境动作。
        run.goal?.syncScore(this._score.score + lockBonus);
        let pushedOut = false;
        if (mutation && !run.goal?.done) {
            const events = mutation.onLock(this._model, run.lockCount, piece.color);
            for (const event of events) {
                if (event.type === 'frostRain' && event.pushedOut > 0) {
                    pushedOut = true;
                    await this._view.board?.rebuild(this._model, TUNING.settle.dropMs, this._fogOpts(piece.color));
                    run.token.throwIfCancelled();
                    break;
                }
                if (event.type === 'fog') continue;
                if (event.type === 'frostRain') {
                    audio.play('frost_insert');
                    this._view.banner?.show('霜降插行', 'row');
                }
                if (event.type === 'magnet' && event.shifted) audio.play('magnet_shift', 0.7);
                if (event.type === 'brittle') audio.play('brittle_break', 0.8);
                await this._view.board?.rebuild(this._model, TUNING.settle.dropMs, this._fogOpts(piece.color));
                run.token.throwIfCancelled();
                if (event.type === 'backflowFlush' || event.type === 'frostRain' || (event.type === 'magnet' && event.shifted)) {
                    this._presenter.prepare(run.config.specials && event.type !== 'frostRain', anchor, piece.color);
                    const after = await this._presenter.run(run, event.type === 'backflowFlush');
                    run.token.throwIfCancelled();
                    removed += after.removedCells;
                    chainSum += after.chainSum;
                }
            }
            this._view.mutationBadge?.setCountdown(mutation.params.every, run.lockCount);
        }
        if (run.config.sugar) {
            this._score.add(lockBonus);
            run.sugar.add(removed, chainSum, run.mods.sugarGainMul);
            run.sugar.bonus(run.mods.sugarPerLock);
            if (!wasFull && run.sugar.full) audio.play('sugar_full', 0.6);
        }
        this._level.tryLevelUp(this._score.score);
        this._view.hud?.setLevel(this._level.level);
        this._refreshProgress(run);
        run.recorder?.recordFrame(this._model, this._score.score);
        if (pushedOut) {
            this._fail('被霜降挤出');
        } else if (run.goal?.done) {
            await this._complete(run);
        } else if (run.movesLeft <= 0) {
            this._fail('步数用尽');
        } else if (this._nextPiece && run.shieldsUsed >= run.mods.shieldCharges &&
            !legalPose(this._model, this._nextPiece.cells, this._nextPiece.x,
                mutation?.dir === -1 ? this._model.rows - 1 : 0, mutation)) {
            this._fail('堆到顶了');
        } else {
            await this._maybeTalent(run);
        }
    }

    private _fogOpts(activeColor = this._piece?.color ?? -1): { fogRows?: number; visible?: boolean[][] } {
        const fogRows = this._run?.mutation?.fogRows ?? 0;
        return fogRows ? { fogRows, visible: FogVision.compute(this._model, fogRows, activeColor) } : {};
    }

    private async _maybeTalent(run: RunContext): Promise<void> {
        if (!run.config.talents || !run.talents.shouldOffer(run.groupCount)) return;
        if (this._fsm.isOver) return;
        this._fsm.force('talentPick');
        const pickerView = await UIManager.instance?.open('talentPicker');
        if (run.cancelled) return;
        if (!pickerView) {
            this._fsm.force('playing');
            return;
        }
        const picker = pickerView as unknown as { play: (o: unknown[]) => Promise<number | null> };
        const offers = run.talents.offer(run.rng, false, { allowHints: !!run.config.hint, allowStoneBonus: run.goal?.goal.type === 'stone' });
        audio.play('talent_appear');
        const chosen = await picker.play(offers as unknown[]);
        if (run.cancelled) return;
        const startSugarBefore = run.mods.startSugar;
        if (chosen === null) {
            storage.set(StorageKey.Coins, storage.getNumber(StorageKey.Coins) + run.talents.skip());
            audio.play('talent_skip');
        } else if (run.talents.pick(chosen)) {
            audio.play('talent_pick');
            run.sugar.bonus(run.mods.startSugar - startSugarBefore);
            run.recorder?.recordTalent(chosen);
            run.recorder?.recordFrame(this._model, this._score.score);
        }
        this._view.sugarRail?.setTalentCount(run.talents.owned.length);
        this._refreshProgress(run);
        UIManager.instance?.close('talentPicker');
        this._fsm.force('playing');
        this._dropAcc = 0;
    }

    private async _complete(run: RunContext): Promise<void> {
        if (run.cancelled || this._run !== run) return;
        this._fsm.force('over');
        run.cancel();
        const goal = run.config.goal;
        const stars = goal && run.config.mode === 'level' ? starsFor(this._score.score, goal, run.config.star2!, run.config.star3!) : undefined;
        this._piece = null;
        this._view.piece?.setVisible(false);
        this._view.pad?.setEnabled(false);
        audio.play('ui_star');
        let saved = true;
        try {
            if (run.config.mode === 'level' && run.config.levelId) this._saveLevel(run.config.levelId, stars ?? 1);
            if (run.config.mode === 'daily' && run.config.dailyId) {
                replayStore.markDailyDone(run.config.dailyId, run.lockCount, new Date(),
                    run.config.dailyYear ?? run.startedAt.getFullYear());
                audio.play('daily_done');
            }
            this._saveRun(run);
        } catch (err) {
            saved = false;
            Logger.error('GameController', '通关记录保存失败', err);
        }
        const dialog = await UIManager.instance?.open<DialogView>('dialog');
        if (this._run !== run) return;
        if (!dialog) { nav.toHome(); return; }
        dialog.show({
            tag: run.config.mode === 'daily' ? '每日挑战' : '关卡结算',
            title: stars === 3 ? '完美通关' : '通关成功',
            score: String(this._score.score),
            subtitle: `等级 ${this._level.level} · 消除 ${run.rowsCleared} 行 · 步数 ${run.lockCount}${saved ? '' : ' · 记录保存失败'}`,
            stars,
            buttons: [
                {
                    text: run.config.mode === 'level' && (run.config.levelId ?? 120) < 120 ? '下一关' : '返回',
                    kind: 'primary',
                    onClick: () => {
                        if (run.config.mode === 'level' && run.config.levelId && run.config.levelId < 120) {
                            nav.startLevel(run.config.levelId + 1);
                        } else if (run.config.mode === 'daily') {
                            UIManager.instance?.close('dialog');
                            nav.toDaily();
                        } else {
                            UIManager.instance?.close('dialog');
                            nav.toHome();
                        }
                    },
                },
                { text: '返回首页', kind: 'secondary', onClick: () => { UIManager.instance?.close('dialog'); nav.toHome(); } },
            ],
        });
    }

    private _saveLevel(id: number, stars: number): void {
        const data = storage.levelProgress();
        data.stars[id] = Math.max(data.stars[id] ?? 0, stars);
        data.unlocked = Math.max(data.unlocked, Math.min(120, id + 1));
        storage.setJson(StorageKey.LevelStars, data);
        if (stars > 0) {
            const coins = storage.getNumber(StorageKey.Coins, 0) + stars * 5;
            storage.set(StorageKey.Coins, coins);
        }
    }

    private _saveRun(run: RunContext): void {
        run.recorder?.recordFrame(this._model, this._score.score);
        const record = run.recorder?.finalize(this._score.score);
        if (record) replayStore.save(record);
        if (this._score.score > this._best) {
            this._best = this._score.score;
            storage.set(StorageKey.BestScore, this._best);
            this._view.hud?.setBest(this._best);
        }
        if (run.config.shadow && this._score.score > run.shadowBest) {
            run.shadow.sample(this._elapsed, this._score.score);
            storage.setJson(StorageKey.Shadow, run.shadow.toState(this._score.score, run.config.seed, record?.id ?? ''));
        }
    }

    private _fail(reason: string): void {
        if (this._fsm.state === 'over') return;
        this._fsm.force('over');
        const run = this._run;
        if (run) run.cancel();
        this._piece = null;
        this._view.piece?.setVisible(false);
        this._view.pad?.setEnabled(false);
        audio.play('over');
        haptic.medium();
        if (run) {
            try { this._saveRun(run); }
            catch (err) { Logger.error('GameController', '结算记录保存失败', err); }
        }
        void (async () => {
            const dialog = await UIManager.instance?.open<DialogView>('dialog');
            if (this._run !== run) return;
            if (!dialog) { nav.toHome(); return; }
            dialog.show({
                onReplay: run?.config.mode === 'endless' && replayStore.best() ? () => {
                    UIManager.instance?.close('dialog');
                    UIManager.instance?.close('gameScreen');
                    nav.openReplay();
                } : undefined,
                tag: '本局结束',
                title: reason,
                score: String(this._score.score),
                subtitle: `等级 ${this._level.level} · 消除 ${run?.rowsCleared ?? 0} 行`,
                buttons: [
                    { text: '再来一局', kind: 'primary', onClick: () => { UIManager.instance?.close('dialog'); void this.startRun(this._config); } },
                    { text: '返回首页', kind: 'secondary', onClick: () => { UIManager.instance?.close('dialog'); nav.toHome(); } },
                ],
            });
        })();
    }

    private async tryBurst(): Promise<void> {
        const run = this._run;
        if (!run || !run.config.sugar || !run.sugar.full || !this._fsm.canAcceptInput()) return;
        this._fsm.force('itemSelect');
        this._input?.cancel();
        this._view.pad?.setEnabled(false);
        try {
            let color: number | null = null;
            if (run.sugar.nextLevel === 3) {
                const picker = await UIManager.instance?.open<ColorPickerView>('colorPicker');
                if (run.cancelled || !picker) return;
                color = await picker.play();
                if (run.cancelled) return;
                UIManager.instance?.close('colorPicker');
                if (color === null) return;
            }
            await this._sugarBurst.run(run, color);
            if (run.cancelled) return;
            this._refreshProgress(run);
            run.recorder?.recordFrame(this._model, this._score.score);
            if (run.goal?.done) await this._complete(run);
            else {
                if (this._piece && !legalPose(this._model, this._piece.cells, this._piece.x, this._piece.y, run.mutation)) {
                    this._fail('堆到顶了');
                    return;
                }
                this._view.board?.setFog(this._model, this._fogOpts());
                this.syncPiece();
            }
        } catch (err) {
            if (!run.cancelled) {
                Logger.error('GameController', '糖爆结算异常', err);
                this._fail('结算中断，请重试');
            }
        } finally {
            if (!run.cancelled) {
                this._view.pad?.setEnabled(true);
                this._fsm.force('playing');
                this._dropAcc = 0;
                if (this._pauseRequested) this.requestPause();
            }
        }
    }

    private async tryHint(): Promise<void> {
        const run = this._run;
        const hint = run?.config.hint;
        const piece = this._piece;
        if (!run || !hint || !piece || run.lockCount !== 0 || !this._fsm.canAcceptInput()) return;
        if (!Number.isInteger(hint.rotation) || hint.rotation < 0 || hint.rotation >= 4) return;
        if (!replayStore.canUseHint()) {
            void UIManager.instance?.toast('今天的提示已使用');
            return;
        }
        const cells = rotationCells(hint.shape, hint.rotation);
        const dir = run.mutation?.dir ?? 1;
        const startY = dir === 1 ? 0 : this._model.rows - 1;
        const prefab = assets.getPrefab('prefabs/game/Highlight');
        const layer = this._view.fxLayer;
        if (!prefab || !layer || hint.shape !== piece.shapeIndex ||
            !legalPose(this._model, cells, hint.x, startY, run.mutation)) return;
        const y = dropYForPose(this._model, cells, hint.x, startY, run.mutation);
        const preview = piece.clone();
        const valid = (cells: PieceModel['cells'], x: number, y: number) => legalPose(this._model, cells, x, y, run.mutation);
        while (preview.rotation !== hint.rotation) {
            if (!tryRotate(preview, this._model, dir, valid)) break;
        }
        while (preview.rotation === hint.rotation && preview.x !== hint.x) {
            const x = preview.x + Math.sign(hint.x - preview.x);
            if (!valid(preview.cells, x, preview.y)) break;
            preview.x = x;
        }
        if (preview.rotation !== hint.rotation || preview.x !== hint.x ||
            dropYForPose(this._model, preview.cells, preview.x, preview.y, run.mutation) !== y) {
            void UIManager.instance?.toast('当前落块已错过首步提示位置');
            return;
        }
        const cost = Math.max(0, TUNING.daily.hintsCost - run.mods.hintDiscount);
        const coins = storage.getNumber(StorageKey.Coins, 0);
        if (coins < cost) {
            void UIManager.instance?.toast('金币不足（还差 ' + (cost - coins) + '）');
            audio.play('ui_error');
            return;
        }

        for (const cell of cells) {
            const node = instantiate(prefab);
            node.setParent(layer);
            this._highlightNodes.push(node);
            const pos = this._view.board?.cellToLocal(y + dir * cell.r, hint.x + cell.c);
            node.setPosition(pos ?? new Vec3(0, 0, 0));
            node.getComponent(HighlightView)?.flash(TUNING.daily.hintMs);
        }
        this.scheduleOnce(() => this._clearHints(), TUNING.daily.hintMs / 1000 + 0.2);
        storage.set(StorageKey.Coins, coins - cost);
        replayStore.markHintUsed();
        audio.play('ui_hint');
        void UIManager.instance?.toast('提示已使用（-' + cost + ' 金币）');
    }

    private _captureRun(run: RunContext, piece: PieceModel) {
        return {
            piece: piece.clone(), next: this._nextPiece?.clone(), source: this._source.capture(),
            rng: run.rng.getState(), goal: run.goal?.snapshot(), recorder: run.recorder?.capture(),
            talents: run.talents.capture(), mutation: run.mutation?.capture(), pieces: run.pieces,
            mirrorColor: this._mirrorColor, shields: run.shieldsUsed, stones: run.stoneCleared,
            skippedCoins: run.talents.skipCoins, bursts: run.burstsUsed,
        };
    }

    private undo(): void {
        const run = this._run;
        if (!run || !this._undoSnapshot || !this._undoRun) return;
        if (this._fsm.state !== 'playing' || this._locking) return;
        if (run.mods.undoCharges - this._undoUsed <= 0) return;
        this._undoUsed++;
        const snap = this._undoSnapshot;
        this._undoSnapshot = null;
        snap.restore(this._model);
        this._score.score = snap.score;
        this._level.setLevel(snap.levelLevel);
        run.sugar.restore(snap.sugarValue, snap.sugarBursts);
        run.groupCount = snap.groupCount;
        run.lockCount = snap.lockCount;
        run.rowsCleared = snap.rowsCleared;
        run.deferredLocks = snap.deferredLocks;
        const before = this._undoRun;
        this._undoRun = null;
        const skipReward = run.talents.skipCoins - before.skippedCoins;
        if (skipReward > 0) storage.set(StorageKey.Coins, Math.max(0, storage.getNumber(StorageKey.Coins) - skipReward));
        run.talents.restore(before.talents);
        run.rng.setState(before.rng);
        this._source.restore(before.source);
        if (before.mutation !== undefined) run.mutation?.restore(before.mutation);
        if (before.recorder) run.recorder?.restore(before.recorder);
        if (before.goal) run.goal?.restore(before.goal);
        run.shieldsUsed = before.shields;
        run.stoneCleared = before.stones;
        run.burstsUsed = before.bursts;
        run.pieces = before.pieces;
        this._mirrorColor = before.mirrorColor;
        this._piece = before.piece;
        const dir = run.mutation?.dir ?? 1;
        const startY = dir === 1 ? 0 : this._model.rows - 1;
        if (legalPose(this._model, before.piece.cells, before.piece.x, startY, run.mutation)) before.piece.y = startY;
        this._nextPiece = before.next ?? null;
        this._dropAcc = 0;
        this._view.clearScoreStars();
        this._view.board?.clearAll();
        void this._view.board?.rebuild(this._model, 0, this._fogOpts());
        this._view.hud?.setNext(this._nextPiece, this._frames);
        this._view.hud?.setLevel(this._level.level);
        this._view.sugarRail?.setTalentCount(run.talents.owned.length);
        if (run.mutation) this._view.mutationBadge?.setCountdown(run.mutation.params.every, run.lockCount);
        this._refreshProgress(run);
        this.syncPiece();
        audio.play('undo');
    }

    requestPause(): void {
        if (this._fsm.state !== 'playing') return;
        this._pauseRequested = false;
        const run = this._run;
        this._stopInputForPause();
        void (async () => {
            const dialog = await UIManager.instance?.open<DialogView>('dialog');
            if (this._run !== run || this._fsm.state !== 'paused') return;
            if (!dialog) { this.resume(); return; }
            dialog.show({
                title: '已暂停',
                subtitle: '休息一下，随时回来继续',
                buttons: [
                    { text: '继续游戏', kind: 'primary', onClick: () => { UIManager.instance?.close('dialog'); this.resume(); } },
                    { text: '返回首页', kind: 'secondary', onClick: () => { UIManager.instance?.close('dialog'); nav.toHome(); } },
                ],
            });
        })();
    }

    private _stopInputForPause(): void {
        this._fsm.force('paused');
        this._input?.cancel();
        this._view.pad?.setEnabled(false);
    }

    resume(): void {
        if (this._fsm.state !== 'paused' || this._run?.cancelled) return;
        this._view.pad?.setEnabled(true);
        this._fsm.force('playing');
        this._dropAcc = 0;
    }

    requestRestart(): void {
        if (!this._fsm.canAcceptInput()) return;
        if (this._score.score <= 0 || !TUNING.rules.confirmRestart) {
            void this.startRun(this._config);
            return;
        }
        const run = this._run;
        this._stopInputForPause();
        void (async () => {
            const dialog = await UIManager.instance?.open<DialogView>('dialog');
            if (this._run !== run || this._fsm.state !== 'paused') return;
            if (!dialog) { this.resume(); return; }
            dialog.show({
                title: '重新开始？',
                subtitle: '当前进度会清空',
                buttons: [
                    { text: '确认重开', kind: 'primary', onClick: () => { UIManager.instance?.close('dialog'); void this.startRun(this._config); } },
                    { text: '继续游戏', kind: 'secondary', onClick: () => { UIManager.instance?.close('dialog'); this.resume(); } },
                ],
            });
        })();
    }

    private _onKeyDown(e: EventKeyboard): void {
        if (!this._fsm.canAcceptInput()) return;
        switch (e.keyCode) {
            case KeyCode.ARROW_LEFT:
                this.tryMove(-1, 0);
                break;
            case KeyCode.ARROW_RIGHT:
                this.tryMove(1, 0);
                break;
            case KeyCode.ARROW_DOWN:
                if (this.tryMove(0, this._run?.mutation?.dir ?? 1)) this._dropAcc = 0;
                break;
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_X:
                this.rotate();
                break;
            case KeyCode.SPACE:
                this.hardDrop();
                break;
            default:
                break;
        }
    }

    private _onAppHide(): void {
        if (this._fsm.state === 'playing') this.requestPause();
        else if (this._run && !this._run.cancelled && this._fsm.state !== 'paused') this._pauseRequested = true;
    }

    onDestroy(): void {
        this._backgroundRequest++;
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        game.off(Game.EVENT_HIDE, this._onAppHide, this);
        this._input?.destroy();
        if (this._run) this._run.cancel();
        this._run = null;
    }
}
