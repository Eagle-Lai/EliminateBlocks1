/**
 * 棋盘视图：静态网格背景（单 Graphics，一次绘制）+ 方块节点池 + 消除/下落动画。
 * 用 BlockData 对象身份做 diff，因此重力与消行位移都能自动得到起点与终点。
 */
import { _decorator, Color, Component, Graphics, Node, SpriteFrame, Tween, Vec3 } from 'cc';
import { THEME } from '../config/ThemeConfig';
import type { BlockData, BoardModel } from '../core/BoardModel';
import type { Cell } from '../config/PieceShapeTable';
import { BlockView } from './BlockView';
import { BurstPool } from '../fx/BurstPool';
import { createNode, drawRoundRect, setSize } from '../ui/UIFactory';
import { tweenNode } from '../utils/Anim';

const { ccclass } = _decorator;

@ccclass('BoardView')
export class BoardView extends Component {
    private _cols = 10;
    private _rows = 16;
    private _cell = 60;
    private _boardW = 600;
    private _boardH = 960;

    private _frames: (SpriteFrame | null)[] = [];
    private _bgNode: Node | null = null;
    private _bg: Graphics | null = null;
    private _blockLayer: Node | null = null;
    private _burst: BurstPool | null = null;

    private _views = new Map<BlockData, BlockView>();
    private _pool: BlockView[] = [];

    init(frames: (SpriteFrame | null)[]): void {
        this._frames = frames;
        this._blockLayer = createNode('BlockLayer', this.node);
        this._bgNode = createNode('GridBg', this.node);
        this._bgNode.setSiblingIndex(0);
        this._bg = this._bgNode.addComponent(Graphics);
        this._burst = new BurstPool(this.node, 8);
    }

    layout(cols: number, rows: number, cell: number): void {
        this._cols = cols;
        this._rows = rows;
        this._cell = cell;
        this._boardW = cell * cols;
        this._boardH = cell * rows;
        setSize(this.node, this._boardW, this._boardH);
        if (this._bgNode) setSize(this._bgNode, this._boardW, this._boardH);
        this._drawBackground();
        this._applyCellSize();
    }

    private _drawBackground(): void {
        const g = this._bg;
        if (!g) return;
        const cell = this._cell;
        const w = this._boardW;
        const h = this._boardH;

        g.clear();
        drawRoundRect(g, w + 18, h + 18, 26, THEME.boardTray, THEME.boardTrayBorder, 3);

        for (let r = 0; r < this._rows; r++) {
            for (let c = 0; c < this._cols; c++) {
                const x = -w / 2 + c * cell + 2;
                const y = h / 2 - (r + 1) * cell + 2;
                g.fillColor = THEME.emptyCell;
                g.roundRect(x, y, cell - 4, cell - 4, cell * 0.18);
                g.fill();
            }
        }
    }

    private _applyCellSize(): void {
        for (const view of this._views.values()) {
            view.setCellSize(this._cell);
            view.applyType(view.type, this._frames[view.type] ?? null);
        }
        for (const view of this._pool) view.setCellSize(this._cell);
        this.rebuildVisualOnly();
    }

    /** 只刷新位置，不做动画（布局变化时调用） */
    private rebuildVisualOnly(): void {
        for (const [block, view] of this._views) {
            void block;
            if (view.r >= 0 && view.c >= 0) {
                view.setCellPos(view.r, view.c, this._boardW, this._boardH, this._cell);
            }
        }
    }

    /** 与模型对齐；moved 的块会从旧位置补间到新位置 */
    async rebuild(model: BoardModel, animateMs = 0): Promise<void> {
        const present = new Set<BlockData>();
        const animations: Promise<void>[] = [];

        for (let r = 0; r < model.rows; r++) {
            for (let c = 0; c < model.cols; c++) {
                const block = model.get(r, c);
                if (!block) continue;
                present.add(block);

                let view = this._views.get(block);
                if (!view) {
                    view = this._obtain();
                    this._views.set(block, view);
                    view.setCellSize(this._cell);
                    view.applyType(block.type, this._frames[block.type] ?? null);
                    view.setCellPos(r, c, this._boardW, this._boardH, this._cell);
                    view.resetVisual();
                    view.playSpawn();
                } else if (view.r !== r || view.c !== c) {
                    const x = -this._boardW / 2 + (c + 0.5) * this._cell;
                    const y = this._boardH / 2 - (r + 0.5) * this._cell;
                    view.r = r;
                    view.c = c;
                    if (animateMs > 0) {
                        Tween.stopAllByTarget(view.node);
                        animations.push(
                            tweenNode(view.node, animateMs, { position: new Vec3(x, y, 0) }, 'quadOut'),
                        );
                    } else {
                        view.node.setPosition(x, y, 0);
                    }
                }
            }
        }

        const dead: BlockData[] = [];
        for (const [block] of this._views) {
            if (!present.has(block)) dead.push(block);
        }
        for (const block of dead) {
            const view = this._views.get(block);
            if (view) this._release(view);
            this._views.delete(block);
        }

        await Promise.all(animations);
    }

    /** 消除动画：缩小淡出 + 碎片迸射 */
    async playPop(model: BoardModel, cells: readonly Cell[], durationMs: number): Promise<void> {
        const tasks: Promise<void>[] = [];
        for (const cell of cells) {
            const block = model.get(cell.r, cell.c);
            if (!block) continue;
            const view = this._views.get(block);
            if (!view) continue;
            tasks.push(view.playPop(durationMs));
            if (this._burst) {
                this._burst.spawn(
                    view.node.position.clone(),
                    THEME.blockColors[block.type] ?? THEME.blockColors[0],
                    this._cell * 0.42,
                );
            }
        }
        await Promise.all(tasks);
    }

    async playRowFlash(model: BoardModel, rows: readonly number[], durationMs: number): Promise<void> {
        const tasks: Promise<void>[] = [];
        for (const row of rows) {
            for (let c = 0; c < model.cols; c++) {
                const block = model.get(row, c);
                if (!block) continue;
                const view = this._views.get(block);
                if (view) tasks.push(view.playFade(durationMs));
            }
        }
        await Promise.all(tasks);
    }

    clearAll(): void {
        for (const view of this._views.values()) this._release(view);
        this._views.clear();
        if (this._burst) this._burst.clear();
    }

    private _obtain(): BlockView {
        const view = this._pool.pop() ?? new BlockView(this._blockLayer!);
        view.setVisible(true);
        view.resetVisual();
        return view;
    }

    private _release(view: BlockView): void {
        view.setVisible(false);
        view.resetVisual();
        view.r = -1;
        view.c = -1;
        this._pool.push(view);
    }

    /** 屏幕/棋盘本地坐标 -> 行列 */
    localToCell(local: Vec3): { r: number; c: number } {
        const c = Math.floor((local.x + this._boardW / 2) / this._cell);
        const r = Math.floor((this._boardH / 2 - local.y) / this._cell);
        return { r, c };
    }

    cellToLocal(r: number, c: number): Vec3 {
        return new Vec3(
            -this._boardW / 2 + (c + 0.5) * this._cell,
            this._boardH / 2 - (r + 0.5) * this._cell,
            0,
        );
    }

    get cell(): number {
        return this._cell;
    }

    get boardW(): number {
        return this._boardW;
    }

    get boardH(): number {
        return this._boardH;
    }
}
