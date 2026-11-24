/**
 * 棋盘视图：GridCell / Block / FogCell 全部来自 Prefab 池化实例。
 * 用 BlockData 对象身份做 diff，重力与消行位移因此能拿到准确起终点。
 */
import {
    _decorator,
    Component,
    Node,
    Prefab,
    Sprite,
    SpriteFrame,
    Tween,
    UITransform,
    Vec3,
    instantiate,
    tween,
} from 'cc';
import type { BlockData, BoardModel } from '../core/BoardModel';
import type { Cell } from '../config/PieceShapeTable';
import { BlockView } from './BlockView';
import { tweenNode } from '../utils/Anim';
import { assets } from '../service/AssetService';

const { ccclass, property } = _decorator;

export interface BoardViewOptions {
    /** 迷雾可见矩阵（true=可见） */
    visible?: boolean[][];
    fogRows?: number;
}

@ccclass('BoardView')
export class BoardView extends Component {
    @property(Prefab) cellPrefab: Prefab | null = null;
    @property(Prefab) blockPrefab: Prefab | null = null;
    @property(Prefab) fogPrefab: Prefab | null = null;
    @property(Node) gridRoot: Node | null = null;
    @property(Node) blockLayer: Node | null = null;
    @property(Node) fogLayer: Node | null = null;
    @property(Sprite) tray: Sprite | null = null;
    @property(Sprite) frame: Sprite | null = null;

    private _cols = 10;
    private _rows = 16;
    private _cell = 60;
    private _boardW = 600;
    private _boardH = 960;

    private _frames: (SpriteFrame | null)[] = [];
    private _cells: Node[] = [];
    private _views = new Map<BlockData, BlockView>();
    private _pool: BlockView[] = [];
    private _applied = new Map<BlockData, string>();
    private _fogPool: Node[] = [];
    private _fogActive: Node[] = [];

    init(frames: (SpriteFrame | null)[]): void {
        this._frames = frames;
    }

    layout(cols: number, rows: number, cell: number): void {
        this._cols = cols;
        this._rows = rows;
        this._cell = cell;
        this._boardW = cell * cols;
        this._boardH = cell * rows;

        const ut = this.node.getComponent(UITransform);
        if (ut) ut.setContentSize(this._boardW, this._boardH);

        if (this.tray) {
            const tu = this.tray.node.getComponent(UITransform);
            if (tu) tu.setContentSize(this._boardW + 18, this._boardH + 18);
        }
        if (this.frame) {
            const fu = this.frame.node.getComponent(UITransform);
            if (fu) fu.setContentSize(this._boardW + 22, this._boardH + 22);
        }

        this._buildGrid();
        for (const view of this._views.values()) view.setCellSize(cell);
        for (const view of this._pool) view.setCellSize(cell);
        this._layoutVisuals();
    }

    private _prefab(key: string, current: Prefab | null): Prefab | null {
        return current ?? assets.getPrefab(`prefabs/${key}`);
    }

    private _buildGrid(): void {
        const prefab = this._prefab('game/GridCell', this.cellPrefab);
        if (!this.gridRoot || !prefab) return;
        const need = this._cols * this._rows;
        while (this._cells.length < need) {
            const node = instantiate(prefab);
            node.setParent(this.gridRoot);
            this._cells.push(node);
        }
        for (let i = 0; i < this._cells.length; i++) {
            const node = this._cells[i];
            node.active = i < need;
            if (!node.active) continue;
            const r = Math.floor(i / this._cols);
            const c = i % this._cols;
            const ui = node.getComponent(UITransform);
            if (ui) ui.setContentSize(this._cell * 0.92, this._cell * 0.92);
            node.setPosition(
                -this._boardW / 2 + (c + 0.5) * this._cell,
                this._boardH / 2 - (r + 0.5) * this._cell,
                0,
            );
        }
    }

    private _layoutVisuals(): void {
        for (const view of this._views.values()) {
            if (view.r >= 0) view.setCellPos(view.r, view.c, this._boardW, this._boardH, this._cell);
        }
    }

    async rebuild(model: BoardModel, animateMs = 0, opts: BoardViewOptions = {}): Promise<void> {
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
                    view.applyBlock(block, this._frames);
                    this._applied.set(block, this._keyOf(block));
                    view.setCellPos(r, c, this._boardW, this._boardH, this._cell);
                    view.resetVisual();
                    view.playSpawn();
                } else {
                    const key = this._keyOf(block);
                    if (this._applied.get(block) !== key) {
                        view.applyBlock(block, this._frames);
                        this._applied.set(block, key);
                    }
                    if (view.r !== r || view.c !== c) {
                        const x = -this._boardW / 2 + (c + 0.5) * this._cell;
                        const y = this._boardH / 2 - (r + 0.5) * this._cell;
                        view.r = r;
                        view.c = c;
                        if (animateMs > 0) {
                            Tween.stopAllByTarget(view.node);
                            animations.push(tweenNode(view.node, animateMs, { position: new Vec3(x, y, 0) }, 'quadOut'));
                        } else {
                            view.node.setPosition(x, y, 0);
                        }
                    }
                }
            }
        }

        const dead: BlockData[] = [];
        for (const [block] of this._views) if (!present.has(block)) dead.push(block);
        for (const block of dead) {
            const view = this._views.get(block);
            if (view) this._release(view);
            this._views.delete(block);
            this._applied.delete(block);
        }

        this._refreshFog(model, opts);
        await Promise.all(animations);
    }

    private _keyOf(block: BlockData): string {
        return `${block.type}|${block.kind ?? ''}|${block.special ?? ''}`;
    }

    private _refreshFog(model: BoardModel, opts: BoardViewOptions): void {
        const fogRows = opts.fogRows ?? 0;
        const fogPrefab = this._prefab('game/FogCell', this.fogPrefab);
        if (!this.fogLayer || !fogPrefab || fogRows <= 0) {
            for (const node of this._fogActive) node.active = false;
            this._fogActive = [];
            return;
        }
        for (const node of this._fogActive) node.active = false;
        this._fogActive = [];
        let index = 0;
        for (let r = 0; r < Math.min(fogRows, model.rows); r++) {
            for (let c = 0; c < model.cols; c++) {
                const visible = opts.visible ? opts.visible[r]?.[c] !== false : false;
                const block = model.get(r, c);
                if (visible || !block) continue;
                let node = this._fogPool[index];
                if (!node) {
                    node = instantiate(fogPrefab);
                    node.setParent(this.fogLayer);
                    this._fogPool.push(node);
                }
                index++;
                node.active = true;
                const ui = node.getComponent(UITransform);
                if (ui) ui.setContentSize(this._cell, this._cell);
                node.setPosition(
                    -this._boardW / 2 + (c + 0.5) * this._cell,
                    this._boardH / 2 - (r + 0.5) * this._cell,
                    0,
                );
                this._fogActive.push(node);
            }
        }
    }

    async playPop(model: BoardModel, cells: readonly Cell[], durationMs: number): Promise<void> {
        const tasks: Promise<void>[] = [];
        for (const cell of cells) {
            const block = model.get(cell.r, cell.c);
            if (!block) continue;
            const view = this._views.get(block);
            if (view) tasks.push(view.playPop(durationMs));
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
        this._applied.clear();
        for (const node of this._fogActive) node.active = false;
        this._fogActive = [];
    }

    private _obtain(): BlockView {
        const view = this._pool.pop() ?? this._createView();
        view.node.active = true;
        view.resetVisual();
        return view;
    }

    private _createView(): BlockView {
        const prefab = this._prefab('game/Block', this.blockPrefab);
        if (!prefab || !this.blockLayer) {
            throw new Error('BoardView：Block Prefab 或 BlockLayer 未绑定');
        }
        const node = instantiate(prefab);
        node.setParent(this.blockLayer);
        const view = node.getComponent(BlockView);
        if (!view) throw new Error('Block.prefab 根节点缺少 BlockView');
        return view;
    }

    private _release(view: BlockView): void {
        view.setVisible(false);
        view.resetVisual();
        view.r = -1;
        view.c = -1;
        this._pool.push(view);
    }

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

    get cols(): number {
        return this._cols;
    }

    get rows(): number {
        return this._rows;
    }
}
