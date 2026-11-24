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
    input,
    game,
    Game,
} from 'cc';
import { TUNING } from '../config/GameTuning';
import { rotationCells } from '../core/PieceSource';
import { HighlightView } from '../view/HighlightView';
import { THEME } from '../config/ThemeConfig';
import { BoardModel } from '../core/BoardModel';
import { PieceModel } from '../core/PieceModel';
import { collides, findDropY } from '../core/CollisionService';
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
import { platform } from '../service/PlatformAdapter';
import { Logger } from '../utils/Logger';
import { CancelError } from '../utils/CancelToken';
import { GameFSM } from '../app/GameFSM';
import { RunContext } from '../app/RunContext';
import { endlessConfig, levelConfig, starsFor, type RunConfig } from '../app/GameMode';
import type { LevelEntry } from '../config/LevelTable';
import { nav } from '../app/Navigator';
import { RunBootstrapper } from './RunBootstrapper';
import { BoardInput } from './BoardInput';
import { ResolvePresenter } from './ResolvePresenter';
import { SugarBurst } from './SugarBurst';
import { captureUndo, type UndoSnapshot } from './UndoSnapshot';
import { replayStore } from '../service/ReplayStore';
import { MutationBadgeView } from '../view/MutationBadgeView';
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
    private _config: RunConfig = endlessConfig(1);
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
    private _bestAtStart = 0;
    private _elapsed = 0;
    private _lastSample = 0;
    private _locking = false;
    private _lastMoveSoundAt = 0;
    private _undoSnapshot: UndoSnapshot | null = null;
    private _undoUsed = 0;

    boot(opts: GameBootOptions): void {
        this._layout = opts.layout;
        this._frames = opts.frames;
        this._view = opts.view;
        this._config = opts.config;
        this._best = opts.best;
        this._bestAtStart = opts.best;
        this._model = new BoardModel(TUNING.board.cols, TUNING.board.rows);
        this._pool = new BurstPool(this._view.fxLayer ?? this._view.node);
        void this._pool.preload();

        this._view.board?.init(this._frames);
        this._view.piece?.init(this._frames);
        this._view.board?.layout(TUNING.board.cols, TUNING.board.rows, this._layout.cell);
        this._view.piece?.layout(this._layout.cell, this._layout.boardW, this._layout.boardH);
        this._view.applyLayout(this._layout);
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
            onMove: (dx, dy) => this.tryMove(dx, dy),
            onRotate: () => this.rotate(),
            onTapCell: () => void 0,
        });
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        game.on(Game.EVENT_HIDE, this._onAppHide, this);
        void this.startRun(this._config);
    }

    private _setBackground(): void {
        const chapter = this._config.levelId ? Math.ceil(this._config.levelId / 20) : 1;
        const bundle = this._config.mode === 'daily' ? 'daily' : `ch${chapter}`;
        const path = this._config.mode === 'daily' ? 'bg_daily' : `bg_ch${chapter}`;
        assets.loadSpriteFrameFromBundle(bundle, path).then((sf) => {
            if (sf && this._view.bg && this._view.bg.isValid) this._view.bg.spriteFrame = sf;
        });
    }

    async startRun(config: RunConfig = this._config): Promise<void> {
        if (this._run) this._run.cancel();
        this._config = config;
        this._locking = false;
        const boot = RunBootstrapper.create(config);
        this._run = boot.run;
        this._model = boot.model;
        this._source = boot.source;

        this._score.reset();
        this._level.reset();
        this._dropAcc = 0;
        this._elapsed = 0;
        this._lastSample = 0;
        this._undoSnapshot = null;
        this._undoUsed = 0;
        this._piece = null;
        this._nextPiece = null;

        this._presenter = new ResolvePresenter(this._view, this._model, this._score, this._level, this._pool);
        this._sugarBurst = new SugarBurst(this._view, this._model, this._score, this._presenter);

        this._view.board?.clearAll();
        this._view.piece?.setVisible(false);
        this._view.floats?.clear();
        this._view.banner?.clear();
        this._view.hud?.setScore(0);
        this._view.hud?.setLevel(1);
        this._view.hud?.setProgress(0);
        this._view.hud?.setBest(this._best);
        this._view.hud?.setTitle(config.title);
        this._view.hud?.setGoal(!!config.goal, config.goal ? this._goalText(config) : '', '');
        this._view.sugarRail?.setValue(0);
        this._view.sugarRail?.setTalentCount(0);
        this._view.shadowBar?.reset();

        const mutation = this._run.mutation;
        this._view.hud?.setMutationVisible(!!mutation);
        if (mutation) {
            this._view.mutationBadge?.setMutation(mutation.def.id, mutation.params.every, 0);
            const intro = await UIManager.instance?.open<MutationIntroView>('mutationIntro');
            if (intro) {
                audio.play(`mutation_${mutation.def.id}` as never);
                await intro.play(mutation.def.id, mutation.tier);
                UIManager.instance?.close('mutationIntro');
            }
        }

        await this._view.board?.rebuild(this._model, 0, this._fogOpts());
        this._fsm.force('playing');
        audio.play('start');
        this.spawnNext();
    }

    private _goalText(config: RunConfig): string {
        const goal = config.goal;
        if (!goal) return '';
        const names: Record<string, string> = {
            score: `目标 ${goal.target}`,
            rows: `消 ${goal.target} 行`,
            color: `清 ${goal.target} 个同色`,
            special: `造 ${goal.target} 个特殊糖`,
            burst: `糖爆 ${goal.target} 次`,
            stone: `清 ${goal.target} 块霜石`,
        };
        return names[goal.type] ?? `目标 ${goal.target}`;
    }

    private spawnNext(): void {
        const run = this._run;
        if (!run) return;
        const piece = this._nextPiece ?? this._source.next();
        this._nextPiece = this._source.next();
        if (!piece) {
            this._fail('步数用尽');
            return;
        }
        const dir = run.mutation?.dir ?? 1;
        piece.rotation = 0;
        piece.cells = piece.cells.map((c) => ({ r: c.r, c: c.c }));
        piece.x = Math.floor((this._model.cols - piece.width) / 2);
        piece.y = dir === 1 ? 0 : this._model.rows - 1;
        this._piece = piece;
        run.pieces++;

        if (collides(this._model, piece.cells, piece.x, piece.y, dir) || !this._mirrorValid(piece)) {
            this._piece = null;
            this._view.piece?.setVisible(false);
            this._fail('堆到顶了');
            return;
        }
        this._view.hud?.setNext(this._nextPiece, this._frames);
        this.syncPiece();
    }

    private _mirrorValid(piece: PieceModel): boolean {
        const mutation = this._run?.mutation;
        if (!mutation || mutation.mirrors <= 0) return true;
        const mirrored = mutation.mirrorOf(piece.cells, piece.x, this._model.cols);
        return !collides(this._model, mirrored.cells, mirrored.x, piece.y, mutation.dir);
    }

    private syncPiece(): void {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run) {
            this._view.piece?.setVisible(false);
            return;
        }
        const dir = run.mutation?.dir ?? 1;
        const ghostY = findDropY(this._model, piece.cells, piece.x, piece.y, dir);
        let mirrorX: number | null = null;
        if (run.mutation && run.mutation.mirrors > 0) {
            mirrorX = run.mutation.mirrorOf(piece.cells, piece.x, this._model.cols).x;
        }
        this._view.piece?.sync(piece, ghostY, dir, mirrorX);
    }

    private tryMove(dx: number, dy: number): boolean {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run || !this._fsm.canAcceptInput()) return false;
        const dir = run.mutation?.dir ?? 1;
        if (collides(this._model, piece.cells, piece.x + dx, piece.y + dy, dir)) return false;
        if (run.mutation && run.mutation.mirrors > 0) {
            const mirrored = run.mutation.mirrorOf(piece.cells, piece.x + dx, this._model.cols);
            if (collides(this._model, mirrored.cells, mirrored.x, piece.y + dy, dir)) return false;
        }
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
        if (tryRotate(piece, this._model, run.mutation?.dir ?? 1)) {
            this.syncPiece();
            this._view.piece?.playRotate();
            audio.play('rotate');
        }
    }

    hardDrop(): void {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run || !this._fsm.canAcceptInput()) return;
        const dir = run.mutation?.dir ?? 1;
        const targetY = findDropY(this._model, piece.cells, piece.x, piece.y, dir);
        if (targetY !== piece.y) {
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
        const total = Math.max(1, this._best || 1);
        this._view.shadowBar?.setProgress(this._score.score / total, run.shadow.at(this._elapsed) / total);
    }

    private stepDown(): void {
        const piece = this._piece;
        const run = this._run;
        if (!piece || !run) return;
        const dir = run.mutation?.dir ?? 1;
        if (!collides(this._model, piece.cells, piece.x, piece.y + dir, dir)) {
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
        if (run.mods.undoCharges > this._undoUsed) {
            this._undoSnapshot = captureUndo(this._model, this._score, this._level, run);
        }
        this._fsm.transition('resolving');
        this._piece = null;
        this._view.piece?.setVisible(false);
        this._dropAcc = 0;
        run.lockCount++;
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
                this._model.set(r, mirrored.x + cell.c, { type: piece.color, pid: piece.pid + 1000 });
            }
        }

        audio.play('lock', 0.7);
        this._view.piece?.playLock();
        await this._view.board?.rebuild(this._model, 0, this._fogOpts());
        if (run.cancelled) {
            this._locking = false;
            return;
        }
        if (overflow && TUNING.rules.gameOverOnLockAboveTop) {
            this._fail(dir === 1 ? '堆到顶了' : '触顶了');
            return;
        }

        try {
            await this._settle(run);
        } catch (err) {
            if (err instanceof CancelError) {
                this._locking = false;
                return;
            }
            Logger.error('GameController', '结算异常', err);
            this._fsm.force('playing');
            this._dropAcc = 0;
            this._locking = false;
            this.spawnNext();
            return;
        }

        if (run.cancelled || this._fsm.isOver) {
            this._locking = false;
            return;
        }
        this._fsm.force('playing');
        this._dropAcc = 0;
        this._locking = false;
        this.spawnNext();
    }

    private async _settle(run: RunContext): Promise<void> {
        const mutation = run.mutation;
        const flush = !!mutation && mutation.deferredEvery > 0 && run.deferredLocks >= mutation.deferredEvery;
        this._presenter.prepare(!!this._config.specials);
        const stats = await this._presenter.run(run, flush);
        run.deferredLocks = flush ? 0 : run.deferredLocks + 1;

        run.sugar.add(stats.removedCells, stats.maxChain, run.mods.sugarGainMul);
        run.sugar.bonus(run.mods.sugarPerLock);
        this._view.sugarRail?.setValue(run.sugar.value);
        if (run.sugar.full) audio.play('sugar_full', 0.6);

        if (mutation) await this._applyMutation(run, mutation);
        if (run.goal) {
            run.goal.syncScore(this._score.score);
            this._view.hud?.setGoal(true, this._goalText(this._config), run.goal.progressText());
        }
        if (run.goal?.done) {
            await this._complete(run);
            return;
        }
        if (run.config.moveLimit && run.movesLeft <= 0) {
            this._fail('步数用尽');
            return;
        }
        await this._maybeTalent(run);
    }

    private _fogOpts(): { fogRows?: number; visible?: boolean[][] } {
        const run = this._run;
        if (!run?.mutation || run.mutation.fogRows <= 0) return {};
        return { fogRows: run.mutation.fogRows, visible: undefined };
    }

    private async _applyMutation(run: RunContext, mutation: NonNullable<RunContext['mutation']>): Promise<void> {
        const events = mutation.onLock(this._model, run.lockCount, this._piece?.color ?? 0);
        if (events.length === 0) return;
        for (const event of events) {
            if (event.type === 'frostRain') {
                audio.play('frost_insert');
                this._view.banner?.show('霜降插行', 'row');
                if (event.pushedOut > 0) {
                    this._fail('被霜降挤出');
                    return;
                }
            } else if (event.type === 'brittle') {
                audio.play('brittle_break', 0.8);
            } else if (event.type === 'magnet') {
                audio.play('magnet_shift', 0.7);
            } else if (event.type === 'backflowFlush') {
                this._presenter.prepare(false);
                await this._presenter.run(run, true);
            }
        }
        await this._view.board?.rebuild(this._model, TUNING.settle.dropMs, this._fogOpts());
        this._view.mutationBadge?.setCountdown(mutation.params.every, run.lockCount);
    }

    private async _maybeTalent(run: RunContext): Promise<void> {
        if (!run.config.talents || !run.talents.shouldOffer(run.groupCount)) return;
        if (this._fsm.isOver) return;
        this._fsm.force('talentPick');
        const pickerView = await UIManager.instance?.open('talentPicker');
        if (!pickerView) {
            this._fsm.force('playing');
            return;
        }
        const picker = pickerView as unknown as { play: (o: unknown[]) => Promise<number | null> };
        const offers = run.talents.offer(run.rng);
        audio.play('talent_appear');
        const chosen = await picker.play(offers as unknown[]);
        if (chosen === null) {
            run.talents.skip();
            audio.play('talent_skip');
        } else if (run.talents.pick(chosen)) {
            audio.play('talent_pick');
            run.recorder?.recordTalent(chosen);
        }
        this._view.sugarRail?.setTalentCount(run.talents.offersUsed);
        this._view.sugarRail?.setUndoEnabled(run.mods.undoCharges > 0, run.mods.undoCharges);
        UIManager.instance?.close('talentPicker');
        this._fsm.force('playing');
        this._dropAcc = 0;
    }

    private async _complete(run: RunContext): Promise<void> {
        this._fsm.force('over');
        run.cancel();
        const goal = run.config.goal;
        const stars = goal ? starsFor(this._score.score, goal, run.config.star2 ?? 0, run.config.star3 ?? 0) : 1;
        audio.play('ui_star');
        if (run.config.mode === 'level' && run.config.levelId) {
            this._saveLevel(run.config.levelId, stars);
        }
        if (run.config.mode === 'daily' && run.config.dailyId) {
            replayStore.markDailyDone(run.config.dailyId, run.lockCount);
            audio.play('daily_done');
        }
        this._saveRun(run);
        const dialog = await UIManager.instance?.open<DialogView>('dialog');
        dialog?.show({
            tag: run.config.mode === 'daily' ? 'DAILY' : 'LEVEL CLEAR',
            title: stars >= 3 ? '完美通关' : '通关成功',
            score: String(this._score.score),
            subtitle: `等级 ${this._level.level} · 消除 ${run.rowsCleared} 行 · 步数 ${run.lockCount}`,
            stars,
            buttons: [
                {
                    text: run.config.mode === 'level' ? '下一关' : '返回',
                    kind: 'primary',
                    onClick: () => {
                        UIManager.instance?.close('dialog');
                        if (run.config.mode === 'level' && run.config.levelId && run.config.levelId < 120) {
                            nav.startLevel(run.config.levelId + 1);
                        } else if (run.config.mode === 'daily') {
                            nav.toDaily();
                        } else {
                            nav.toHome();
                        }
                    },
                },
                { text: '返回首页', kind: 'secondary', onClick: () => { UIManager.instance?.close('dialog'); nav.toHome(); } },
            ],
        });
    }

    private _saveLevel(id: number, stars: number): void {
        const data = storage.getJson<{ unlocked: number; stars: Record<number, number> }>(StorageKey.LevelStars, {
            unlocked: 1,
            stars: {},
        });
        data.stars[id] = Math.max(data.stars[id] ?? 0, stars);
        data.unlocked = Math.max(data.unlocked, Math.min(120, id + 1));
        storage.setJson(StorageKey.LevelStars, data);
        if (stars > 0) {
            const coins = storage.getNumber(StorageKey.Coins, 0) + stars * 5;
            storage.setJson(StorageKey.Coins, coins);
        }
    }

    private _saveRun(run: RunContext): void {
        const record = run.recorder?.finalize(this._score.score);
        if (record) replayStore.save(record);
        if (this._score.score > this._best) {
            this._best = this._score.score;
            storage.set(StorageKey.BestScore, this._best);
            this._view.hud?.setBest(this._best);
        }
        if (run.config.shadow) {
            storage.setJson(StorageKey.Shadow, run.shadow.toState(this._best, run.config.seed, record?.id ?? ''));
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
        if (run) this._saveRun(run);
        void (async () => {
            const dialog = await UIManager.instance?.open<DialogView>('dialog');
            dialog?.show({
                tag: 'GAME OVER',
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
        if (!run || !run.sugar.full || !this._fsm.canAcceptInput()) return;
        this._fsm.force('itemSelect');
        await this._sugarBurst.run(run);
        if (!this._fsm.isOver) this._fsm.force('playing');
        this._dropAcc = 0;
    }

    /** 撤销：回到上一次锁定前（棋盘/分数/糖能/目标计数整体回滚） */
    /** 残局提示：扣金币后把首步落点高亮 3 秒（P2） */
    private async tryHint(): Promise<void> {
        const run = this._run;
        const hint = this._config.hint;
        if (!run || !hint || !this._fsm.canAcceptInput()) return;
        const cost = Math.max(0, TUNING.daily.hintsCost - run.mods.hintDiscount);
        const coins = storage.getNumber(StorageKey.Coins, 0);
        if (coins < cost) {
            void UIManager.instance?.toast(`金币不足（还差 ${cost - coins}）`);
            audio.play('ui_error');
            return;
        }
        storage.set(StorageKey.Coins, coins - cost);
        audio.play('ui_hint');
        this._view.hud?.setBest(storage.getNumber(StorageKey.BestScore, 0));

        const cells = rotationCells(hint.shape, hint.rotation);
        const dir = run.mutation?.dir ?? 1;
        const y = findDropY(this._model, cells, hint.x, 0, dir);
        const prefab = assets.getPrefab('prefabs/game/Highlight');
        const layer = this._view.fxLayer;
        if (!prefab || !layer) return;
        for (const cell of cells) {
            const node = instantiate(prefab);
            node.setParent(layer);
            const view = node.getComponent(HighlightView);
            const pos = this._view.board?.cellToLocal(y + cell.r, hint.x + cell.c);
            node.setPosition(pos ?? new Vec3(0, 0, 0));
            view?.flash(TUNING.daily.hintMs);
            this.scheduleOnce(() => node.destroy(), TUNING.daily.hintMs / 1000 + 0.2);
        }
        void UIManager.instance?.toast(`提示已使用（-${cost} 金币）`);
    }

    private undo(): void {
        const run = this._run;
        if (!run || !this._undoSnapshot) return;
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
        run.goal?.reset();
        run.goal?.syncScore(this._score.score);

        this._fsm.force('playing');
        this._piece = null;
        this._view.piece?.setVisible(false);
        this._dropAcc = 0;
        this._view.board?.clearAll();
        void this._view.board?.rebuild(this._model, 0, this._fogOpts());
        this._view.hud?.setScore(this._score.score);
        this._view.hud?.setLevel(this._level.level);
        this._view.hud?.setProgress(this._level.progress(this._score.score));
        this._view.sugarRail?.setValue(run.sugar.value);
        if (run.config.goal) this._view.hud?.setGoal(true, this._goalText(this._config), run.goal?.progressText() ?? '');
        this._view.sugarRail?.setUndoEnabled(run.mods.undoCharges - this._undoUsed > 0, run.mods.undoCharges - this._undoUsed);
        audio.play('undo');
        this.spawnNext();
    }

    requestPause(): void {
        if (this._fsm.state !== 'playing') return;
        this._fsm.force('paused');
        void (async () => {
            const dialog = await UIManager.instance?.open<DialogView>('dialog');
            dialog?.show({
                title: '已暂停',
                subtitle: '休息一下，随时回来继续',
                buttons: [
                    { text: '继续游戏', kind: 'primary', onClick: () => { UIManager.instance?.close('dialog'); this.resume(); } },
                    { text: '重新开始', kind: 'secondary', onClick: () => { UIManager.instance?.close('dialog'); void this.startRun(this._config); } },
                ],
            });
        })();
    }

    resume(): void {
        this._fsm.force('playing');
        this._dropAcc = 0;
    }

    requestRestart(): void {
        if (this._fsm.isBusy() || this._fsm.isOverlay()) return;
        if (this._score.score <= 0 || !TUNING.rules.confirmRestart) {
            void this.startRun(this._config);
            return;
        }
        this._fsm.force('paused');
        void (async () => {
            const dialog = await UIManager.instance?.open<DialogView>('dialog');
            dialog?.show({
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
                if (this.tryMove(0, 1)) this._dropAcc = 0;
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
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        game.off(Game.EVENT_HIDE, this._onAppHide, this);
        this._input?.destroy();
        if (this._run) this._run.cancel();
    }
}
