/**
 * 主控制器：唯一能修改模型的地方。
 * 负责把 输入 → 模型 → 结算 → 表现 串起来，并维护对局生命周期。
 */
import {
    _decorator,
    Component,
    EventKeyboard,
    EventTouch,
    Input,
    KeyCode,
    Node,
    SpriteFrame,
    Tween,
    UITransform,
    Vec3,
    game,
    Game,
    input,
    tween,
} from 'cc';
import { TUNING } from '../config/GameTuning';
import { SHAPES } from '../config/PieceShapeTable';
import { THEME } from '../config/ThemeConfig';
import { BoardModel } from '../core/BoardModel';
import { PieceModel } from '../core/PieceModel';
import { PieceFactory } from '../core/PieceFactory';
import { collides, findDropY } from '../core/CollisionService';
import { tryRotate } from '../core/Rotator';
import { ScoreService } from '../core/ScoreService';
import { LevelService } from '../core/LevelService';
import { ResolvePipeline } from '../core/ResolvePipeline';
import type { LayoutInfo } from '../ui/LayoutAdapter';
import { BoardView } from '../view/BoardView';
import { PieceView } from '../view/PieceView';
import { HudView } from '../view/HudView';
import { BannerView } from '../view/BannerView';
import { FloatTextView } from '../view/FloatTextView';
import { DialogView } from '../view/DialogView';
import { UIButton } from '../ui/UIButton';
import { createLabel, createNode, setSize } from '../ui/UIFactory';
import { audio } from '../service/AudioService';
import { haptic } from '../service/HapticService';
import { storage, StorageKey } from '../service/StorageService';
import { platform } from '../service/PlatformAdapter';
import { Logger } from '../utils/Logger';
import { CancelError } from '../utils/CancelToken';
import { wait } from '../utils/Anim';
import { GameFSM } from '../app/GameFSM';
import { RunContext } from '../app/RunContext';

const { ccclass } = _decorator;

export interface GameBootOptions {
    layout: LayoutInfo;
    frames: (SpriteFrame | null)[];
    best: number;
}

@ccclass('GameController')
export class GameController extends Component {
    private _layout!: LayoutInfo;
    private _frames: (SpriteFrame | null)[] = [];

    private _fsm = new GameFSM();
    private _model!: BoardModel;
    private _score = new ScoreService();
    private _level = new LevelService();
    private _run: RunContext | null = null;
    private _runSeq = 0;
    private _factory!: PieceFactory;

    private _piece: PieceModel | null = null;
    private _nextPiece: PieceModel | null = null;
    private _dropAcc = 0;
    private _best = 0;
    private _rowsCleared = 0;
    private _lastMoveSoundAt = 0;

    private _playArea!: Node;
    private _boardRoot!: Node;
    private _board!: BoardView;
    private _pieceView!: PieceView;
    private _hud!: HudView;
    private _banner!: BannerView;
    private _floats!: FloatTextView;
    private _dialog!: DialogView;
    private _playAreaBase = new Vec3();

    private _drag: {
        startX: number;
        startY: number;
        sx: number;
        sy: number;
        moved: boolean;
        at: number;
    } | null = null;

    boot(opts: GameBootOptions): void {
        this._layout = opts.layout;
        this._frames = opts.frames;
        this._best = opts.best;

        this._model = new BoardModel(TUNING.board.cols, TUNING.board.rows);

        this._buildScene();
        this._bindInput();
        game.on(Game.EVENT_HIDE, this._onAppHide, this);
        this.startRun();
    }

    // ────────────────────────────── 构建 ──────────────────────────────

    private _buildScene(): void {
        const L = this._layout;
        setSize(this.node, L.width, L.height);

        const playArea = createNode('PlayArea', this.node);
        setSize(playArea, L.boardW, L.boardH);
        playArea.setPosition(0, L.boardCenterY, 0);
        this._playArea = playArea;
        this._playAreaBase = new Vec3(0, L.boardCenterY, 0);

        const boardRoot = createNode('BoardRoot', playArea);
        setSize(boardRoot, L.boardW, L.boardH);
        this._boardRoot = boardRoot;
        this._board = boardRoot.addComponent(BoardView);
        this._board.init(this._frames);
        this._board.layout(TUNING.board.cols, TUNING.board.rows, L.cell);

        const pieceRoot = createNode('PieceRoot', playArea);
        setSize(pieceRoot, L.boardW, L.boardH);
        this._pieceView = pieceRoot.addComponent(PieceView);
        this._pieceView.init(this._frames);
        this._pieceView.layout(L.cell, L.boardW, L.boardH);

        const floatRoot = createNode('FloatRoot', playArea);
        setSize(floatRoot, L.boardW, L.boardH);
        this._floats = floatRoot.addComponent(FloatTextView);
        this._floats.build();

        const bannerRoot = createNode('BannerRoot', playArea);
        // 放在棋盘垂直中心：顶部是出生区，横幅压在那里会挡住刚生成的骨牌
        bannerRoot.setPosition(0, 0, 0);
        this._banner = bannerRoot.addComponent(BannerView);
        this._banner.build(Math.min(320, L.boardW - 40));

        const hudRoot = createNode('HudRoot', this.node);
        setSize(hudRoot, L.width, L.height);
        this._hud = hudRoot.addComponent(HudView);
        this._hud.build(L, {
            onPause: () => this.requestPause(),
            onRestart: () => this.requestRestart(),
        });
        this._hud.setBest(this._best);

        this._buildPad(L);

        const hint = createLabel(this.node, '拖动移动 · 轻点旋转 · 同色 3+ 连消', {
            size: 18,
            color: THEME.textSecondary,
            width: L.width - 40,
        });
        hint.node.setPosition(0, L.hintCenterY, 0);

        const dialogRoot = createNode('DialogRoot', this.node);
        setSize(dialogRoot, L.width, L.height);
        this._dialog = dialogRoot.addComponent(DialogView);
        this._dialog.build(L.width, L.height);
    }

    private _buildPad(L: LayoutInfo): void {
        const pad = createNode('PadRoot', this.node);
        setSize(pad, L.width, TUNING.ui.padHeight);
        pad.setPosition(0, L.padCenterY, 0);

        const specs: Array<{
            text: string;
            w: number;
            kind: 'secondary' | 'primary';
            hold?: boolean;
            onClick: () => void;
        }> = [
            { text: '←', w: 104, kind: 'secondary', hold: true, onClick: () => this.tryMove(-1, 0) },
            { text: '→', w: 104, kind: 'secondary', hold: true, onClick: () => this.tryMove(1, 0) },
            { text: '↻', w: 104, kind: 'secondary', onClick: () => this.rotate() },
            { text: '直落', w: 216, kind: 'primary', onClick: () => this.hardDrop() },
        ];

        const gap = 16;
        const total = specs.reduce((sum, s) => sum + s.w, 0) + gap * (specs.length - 1);
        let cursor = -total / 2;

        for (const spec of specs) {
            const node = createNode(`Btn_${spec.text}`, pad);
            setSize(node, spec.w, 104);
            node.setPosition(cursor + spec.w / 2, 0, 0);
            const btn = node.addComponent(UIButton);
            btn.init({
                width: spec.w,
                height: 104,
                text: spec.text,
                kind: spec.kind,
                fontSize: spec.kind === 'primary' ? 30 : 40,
                hold: spec.hold ? { delayMs: TUNING.input.holdDelayMs, repeatMs: TUNING.input.holdRepeatMs } : undefined,
                onClick: spec.onClick,
            });
            cursor += spec.w + gap;
        }
    }

    // ────────────────────────────── 输入 ──────────────────────────────

    private _bindInput(): void {
        this._boardRoot.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this._boardRoot.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this._boardRoot.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this._boardRoot.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    private _toBoardLocal(e: EventTouch): Vec3 {
        const ui = e.getUILocation();
        const uiTransform = this._boardRoot.getComponent(UITransform)!;
        return uiTransform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
    }

    private _onTouchStart(e: EventTouch): void {
        if (!this._fsm.canAcceptInput() || !this._piece) return;
        audio.unlock();
        const local = this._toBoardLocal(e);
        this._drag = {
            startX: local.x,
            startY: local.y,
            sx: 0,
            sy: 0,
            moved: false,
            at: Date.now(),
        };
    }

    private _onTouchMove(e: EventTouch): void {
        const drag = this._drag;
        if (!drag || !this._fsm.canAcceptInput() || !this._piece) return;
        const local = this._toBoardLocal(e);
        const cell = this._board.cell;

        const tx = Math.round((local.x - drag.startX) / cell);
        const ty = Math.round((drag.startY - local.y) / cell);

        while (drag.sx < tx) {
            if (this.tryMove(1, 0)) drag.moved = true;
            drag.sx++;
        }
        while (drag.sx > tx) {
            if (this.tryMove(-1, 0)) drag.moved = true;
            drag.sx--;
        }
        // 纵向只允许向下（与原型一致）
        while (drag.sy < ty) {
            if (this.tryMove(0, 1)) drag.moved = true;
            drag.sy++;
        }
    }

    private _onTouchEnd(e: EventTouch): void {
        const drag = this._drag;
        this._drag = null;
        if (!drag || !this._fsm.canAcceptInput() || !this._piece) return;

        const local = this._toBoardLocal(e);
        const cell = this._board.cell;
        const moved =
            drag.moved ||
            Math.abs(local.x - drag.startX) > cell * TUNING.input.tapMaxCellRatio ||
            Math.abs(local.y - drag.startY) > cell * TUNING.input.tapMaxCellRatio;
        const quick = Date.now() - drag.at < TUNING.input.tapMaxMs;

        if (!moved && quick) this.rotate();
    }

    private _onTouchCancel(): void {
        this._drag = null;
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

    // ────────────────────────────── 对局 ──────────────────────────────

    startRun(): void {
        if (this._run) this._run.cancel();

        this._runSeq++;
        this._run = new RunContext(this._runSeq, Date.now() + this._runSeq * 7919);
        this._factory = new PieceFactory(this._run.rng, TUNING.board.cols, TUNING.board.colorCount);

        this._model.reset();
        this._score.reset();
        this._level.reset();
        this._rowsCleared = 0;
        this._dropAcc = 0;
        this._piece = null;
        this._nextPiece = null;
        this._drag = null;

        this._board.clearAll();
        this._pieceView.setVisible(false);
        this._floats.clear();
        this._banner.clear();
        this._dialog.hide();

        this._fsm.force('playing');
        this._hud.setScore(0);
        this._hud.setLevel(1);
        this._hud.setProgress(0);

        audio.play('start');
        this.spawnNext();
    }

    private spawnNext(): void {
        const piece = this._nextPiece ?? this._factory.create();
        this._nextPiece = this._factory.create();

        piece.x = Math.floor((TUNING.board.cols - piece.width) / 2);
        piece.y = 0;
        piece.rotation = 0;
        piece.cells = SHAPES[piece.shapeIndex].rotations[0].map((c) => ({ r: c.r, c: c.c }));

        this._piece = piece;
        if (this._run) this._run.pieces++;

        if (collides(this._model, piece.cells, piece.x, piece.y)) {
            this._piece = null;
            this._pieceView.setVisible(false);
            this.gameOver();
            return;
        }

        this._hud.setNext(this._nextPiece, this._frames);
        this.syncPiece();
    }

    private syncPiece(): void {
        const piece = this._piece;
        if (!piece) {
            this._pieceView.setVisible(false);
            return;
        }
        const ghostY = findDropY(this._model, piece.cells, piece.x, piece.y);
        this._pieceView.sync(piece, ghostY);
    }

    private tryMove(dx: number, dy: number): boolean {
        const piece = this._piece;
        if (!piece || !this._fsm.canAcceptInput()) return false;
        if (collides(this._model, piece.cells, piece.x + dx, piece.y + dy)) return false;

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
        if (!piece || !this._fsm.canAcceptInput()) return;
        if (tryRotate(piece, this._model)) {
            this.syncPiece();
            this._pieceView.playRotate();
            audio.play('rotate');
        }
    }

    hardDrop(): void {
        const piece = this._piece;
        if (!piece || !this._fsm.canAcceptInput()) return;
        const targetY = findDropY(this._model, piece.cells, piece.x, piece.y);
        if (targetY !== piece.y) {
            piece.y = targetY;
            this.syncPiece();
        }
        void this.lock();
    }

    update(dt: number): void {
        if (!this._fsm.canAcceptInput() || !this._piece) return;
        const clamped = Math.min(dt * 1000, TUNING.input.frameClampMs);
        this._dropAcc += clamped;
        if (this._dropAcc >= this._level.dropIntervalMs) {
            this._dropAcc = 0;
            this.stepDown();
        }
    }

    private stepDown(): void {
        const piece = this._piece;
        if (!piece) return;
        if (!collides(this._model, piece.cells, piece.x, piece.y + 1)) {
            piece.y++;
            this.syncPiece();
        } else {
            void this.lock();
        }
    }

    // ────────────────────────────── 结算 ──────────────────────────────

    private async lock(): Promise<void> {
        if (this._fsm.state !== 'playing' || !this._piece) return;
        const piece = this._piece;
        const run = this._run;
        if (!run) return;

        this._fsm.transition('resolving');
        this._piece = null;
        this._pieceView.setVisible(false);
        this._dropAcc = 0;

        let aboveTop = false;
        for (const cell of piece.cells) {
            const r = piece.y + cell.r;
            const c = piece.x + cell.c;
            if (r < 0) {
                aboveTop = true;
                continue;
            }
            this._model.set(r, c, { type: piece.color, pid: piece.pid });
        }

        audio.play('lock', 0.7);
        this._pieceView.playLock();
        await this._board.rebuild(this._model, 0);
        if (run.cancelled) return;

        if (aboveTop && TUNING.rules.gameOverOnLockAboveTop) {
            this.gameOver();
            return;
        }

        try {
            await this.settle(run);
        } catch (err) {
            if (err instanceof CancelError) return;
            Logger.error('GameController', '结算异常', err);
            this._fsm.force('playing');
            this._dropAcc = 0;
            this.spawnNext();
            return;
        }

        if (run.cancelled || this._fsm.isOver) return;
        // 结算期间被暂停/切后台打断时不要强行开局
        if (!this._fsm.isBusy()) return;

        this._fsm.force('playing');
        this._dropAcc = 0;
        this.spawnNext();
    }

    private async settle(run: RunContext): Promise<void> {
        const pipeline = new ResolvePipeline(this._model, this._score, this._level, {
            onPop: (info) => {
                void this._board.playPop(this._model, info.cells, TUNING.settle.popMs);

                if (info.biggest >= 5) {
                    this._banner.show(`同色 x${info.biggest}`, 'combo');
                } else if (info.chain >= 2) {
                    this._banner.show(`连锁 x${info.chain}`, 'chain');
                }

                audio.play(info.biggest >= 6 ? 'popHigh' : info.biggest >= 4 ? 'popMid' : 'popLow');
                if (info.chain >= 2) {
                    this.shake(6);
                    haptic.medium();
                } else {
                    haptic.light();
                }

                if (run) run.maxChain = Math.max(run.maxChain, info.chain);
            },
            onRowClear: (info) => {
                void this._board.playRowFlash(this._model, info.rows, TUNING.settle.rowFadeMs);
                this._banner.show(info.rows.length > 1 ? `整行清除 x${info.rows.length}` : '整行清除', 'row');
                audio.play('row');
                this.shake(8);
                haptic.medium();
                if (run) run.rowsCleared += info.rows.length;
                this._rowsCleared += info.rows.length;
            },
            onSync: async (ms) => {
                await this._board.rebuild(this._model, ms);
            },
            onScore: (gain, total, anchor) => {
                this._hud.setScore(total);
                if (total > this._best) {
                    this._best = total;
                    this._hud.setBest(total);
                }
                this._hud.setProgress(this._level.progress(total));
                this._floats.spawn(`+${gain}`, this._board.cellToLocal(anchor.r, anchor.c), THEME.primary);
            },
            onLevelUp: (level) => {
                this._hud.setLevel(level);
                this._hud.setProgress(this._level.progress(this._score.score));
                this._banner.show(`LEVEL ${level}`, 'level');
                audio.play('levelUp');
            },
            onGuardExceeded: (iterations) => {
                Logger.error('Resolve', `结算迭代超限（${iterations}），强制收尾`);
            },
            wait: (ms) => wait(ms),
        });

        await pipeline.run(run.token);
        this._hud.setScore(this._score.score);
        this._hud.setProgress(this._level.progress(this._score.score));
    }

    // ────────────────────────────── 生命周期 ──────────────────────────────

    private gameOver(): void {
        if (this._fsm.state === 'over') return;
        this._fsm.force('over');
        this._piece = null;
        this._pieceView.setVisible(false);
        if (this._run) this._run.cancel();

        audio.play('over');
        haptic.medium();

        const score = this._score.score;
        const isNewBest = score > this._best;
        if (isNewBest) {
            this._best = score;
            storage.set(StorageKey.BestScore, score);
            this._hud.setBest(score);
        }

        this._dialog.show({
            tag: 'GAME OVER',
            title: '堆到顶了',
            score: String(score),
            subtitle: `等级 ${this._level.level} · 消除 ${this._rowsCleared} 行${isNewBest ? ' · 新纪录！' : ` · 最高 ${this._best}`}`,
            buttons: [
                { text: '再来一局', kind: 'primary', onClick: () => this.startRun() },
                {
                    text: '分享成绩',
                    kind: 'secondary',
                    onClick: () => platform.shareScore(score, this._level.level),
                },
            ],
        });
    }

    requestPause(): void {
        if (this._fsm.state !== 'playing') return;
        this._fsm.force('paused');
        this._dialog.show({
            title: '已暂停',
            subtitle: '休息一下，随时回来继续',
            buttons: [
                { text: '继续游戏', kind: 'primary', onClick: () => this.resume() },
                { text: '重新开始', kind: 'secondary', onClick: () => this.requestRestart() },
            ],
        });
    }

    resume(): void {
        this._fsm.force('playing');
        this._dropAcc = 0;
    }

    requestRestart(): void {
        if (this._fsm.isBusy()) return;
        if (this._score.score <= 0 || !TUNING.rules.confirmRestart) {
            this.startRun();
            return;
        }
        this._fsm.force('paused');
        this._dialog.show({
            title: '重新开始？',
            subtitle: '当前进度会清空',
            buttons: [
                { text: '确认重开', kind: 'primary', onClick: () => this.startRun() },
                { text: '继续游戏', kind: 'secondary', onClick: () => this.resume() },
            ],
        });
    }

    private shake(strength: number): void {
        if (!TUNING.fx.shakeOnChain) return;
        const node = this._playArea;
        const base = this._playAreaBase;
        Tween.stopAllByTarget(node);
        node.setPosition(base);
        tween(node)
            .to(0.03, { position: new Vec3(base.x + strength, base.y, 0) })
            .to(0.03, { position: new Vec3(base.x - strength * 0.8, base.y, 0) })
            .to(0.03, { position: new Vec3(base.x + strength * 0.4, base.y, 0) })
            .to(0.04, { position: new Vec3(base.x, base.y, 0) })
            .start();
    }

    private _onAppHide(): void {
        if (this._fsm.state === 'playing') this.requestPause();
    }

    onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        game.off(Game.EVENT_HIDE, this._onAppHide, this);
        if (this._run) this._run.cancel();
    }
}
