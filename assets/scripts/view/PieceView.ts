/**
 * 当前骨牌视图：4 个 PieceCell + 4 个 GhostCell（全部 Prefab 池化）。
 * 位置完全由 PieceModel 推导；镜像异变时额外显示一份水平翻转的副本。
 */
import {
    _decorator,
    Color,
    Component,
    Node,
    Prefab,
    Sprite,
    SpriteFrame,
    UIOpacity,
    UITransform,
    Vec3,
    instantiate,
    tween,
} from 'cc';
import type { PieceModel } from '../core/PieceModel';
import { THEME } from '../config/ThemeConfig';
import { assets } from '../service/AssetService';

const { ccclass, property } = _decorator;

interface CellSlot {
    node: Node;
    base: Sprite | null;
    extra: Sprite | null;
    opacity: UIOpacity | null;
}

@ccclass('PieceView')
export class PieceView extends Component {
    @property(Prefab) pieceCellPrefab: Prefab | null = null;
    @property(Prefab) ghostCellPrefab: Prefab | null = null;
    @property(Node) pieceLayer: Node | null = null;
    @property(Node) ghostLayer: Node | null = null;

    private _frames: (SpriteFrame | null)[] = [];
    private _cells: CellSlot[] = [];
    private _mirrors: CellSlot[] = [];
    private _ghosts: CellSlot[] = [];
    private _mirrorGhosts: CellSlot[] = [];
    private _cell = 60;
    private _boardW = 600;
    private _boardH = 960;

    init(frames: (SpriteFrame | null)[]): void {
        this._frames = frames;
        if (this._cells.length) { this.setVisible(false); return; }
        for (let i = 0; i < 4; i++) {
            this._cells.push(this._spawnPieceCell(this.pieceLayer, `Piece_${i}`));
            this._mirrors.push(this._spawnPieceCell(this.pieceLayer, `Mirror_${i}`));
            this._ghosts.push(this._spawnGhostCell(`Ghost_${i}`));
            this._mirrorGhosts.push(this._spawnGhostCell(`MirrorGhost_${i}`));
        }
        this.setVisible(false);
    }

    private _spawnPieceCell(layer: Node | null, name: string): CellSlot {
        const prefab = this.pieceCellPrefab ?? assets.getPrefab('prefabs/game/PieceCell');
        if (!prefab || !layer) throw new Error('PieceView：PieceCell 未绑定');
        const node = instantiate(prefab);
        node.name = name;
        node.setParent(layer);
        node.active = false;
        return {
            node,
            base: node.getComponent(Sprite),
            extra: node.getChildByName('Highlight')?.getComponent(Sprite) ?? null,
            opacity: node.getComponent(UIOpacity),
        };
    }

    private _spawnGhostCell(name: string): CellSlot {
        const prefab = this.ghostCellPrefab ?? assets.getPrefab('prefabs/game/GhostCell');
        if (!prefab || !this.ghostLayer) throw new Error('PieceView：GhostCell 未绑定');
        const node = instantiate(prefab);
        node.name = name;
        node.setParent(this.ghostLayer);
        node.active = false;
        return {
            node,
            base: node.getChildByName('Fill')?.getComponent(Sprite) ?? null,
            extra: node.getChildByName('GoldBorder')?.getComponent(Sprite) ?? null,
            opacity: node.getComponent(UIOpacity),
        };
    }

    layout(cell: number, boardW: number, boardH: number): void {
        this._cell = cell;
        this._boardW = boardW;
        this._boardH = boardH;
        const side = cell;
        for (const slot of [...this._cells, ...this._mirrors, ...this._ghosts, ...this._mirrorGhosts]) {
            const ui = slot.node.getComponent(UITransform);
            if (ui) ui.setContentSize(side, side);
            // 子节点（虚影 Fill/描边、骨牌高光）在 Prefab 里是 96 基准，必须跟随格子尺寸，否则虚影比格子大一圈
            for (const child of slot.node.children) {
                const cu = child.getComponent(UITransform);
                if (cu) cu.setContentSize(side, side);
            }
        }
    }

    /**
     * @param piece 当前骨牌
     * @param ghostY 落点 y（与 piece.y 同向）
     * @param dir 1 向下 / -1 向上（倒悬）
     * @param mirrorX 镜像副本的 x（null 表示不显示镜像）
     */
    sync(piece: PieceModel, ghostY: number, dir: 1 | -1 = 1, mirrorX: number | null = null, mirrorColor = piece.color): void {
        this.setVisible(true);
        const frame = this._frames[piece.color] ?? null;
        const mirrorFrame = this._frames[mirrorColor] ?? null;
        const maxC = piece.width - 1;
        for (let i = 0; i < 4; i++) {
            const cellData = piece.cells[i];
            const slot = this._cells[i];
            const mirror = this._mirrors[i];
            const ghost = this._ghosts[i];
            const mirrorGhost = this._mirrorGhosts[i];
            mirrorGhost.node.active = false;
            if (!cellData) {
                slot.node.active = false;
                mirror.node.active = false;
                ghost.node.active = false;
                continue;
            }
            const r = dir === 1 ? piece.y + cellData.r : piece.y - cellData.r;
            const c = piece.x + cellData.c;
            this._place(slot, frame, r, c);

            if (mirrorX !== null) {
                const column = mirrorX + maxC - cellData.c;
                const overlaps = piece.cells.some(cell => cell.r === cellData.r && piece.x + cell.c === column);
                mirror.node.active = !overlaps;
                if (!overlaps) {
                    this._place(mirror, mirrorFrame, r, column);
                    this._placeGhost(mirrorGhost, ghostY + dir * cellData.r, column, mirrorColor);
                }
            } else {
                mirror.node.active = false;
            }

            this._placeGhost(ghost, ghostY + dir * cellData.r, c, piece.color);
        }
    }

    private _placeGhost(slot: CellSlot, row: number, column: number, shade: number): void {
        slot.node.active = row >= 0 && row < Math.round(this._boardH / this._cell);
        if (!slot.node.active) return;
        slot.node.setPosition(-this._boardW / 2 + (column + 0.5) * this._cell, this._boardH / 2 - (row + 0.5) * this._cell, 0);
        const color = THEME.blockColors[shade] ?? THEME.blockColors[0];
        if (slot.base) slot.base.color = new Color(color.r, color.g, color.b, THEME.ghostFillAlpha);
        if (slot.extra) slot.extra.color = new Color(
            Math.min(255, color.r + 50), Math.min(255, color.g + 50), Math.min(255, color.b + 50), THEME.ghostBorderAlpha,
        );
    }

    private _place(slot: CellSlot, frame: SpriteFrame | null, r: number, c: number): void {
        slot.node.active = true;
        if (slot.base && slot.base.spriteFrame !== frame) slot.base.spriteFrame = frame;
        slot.node.setPosition(
            -this._boardW / 2 + (c + 0.5) * this._cell,
            this._boardH / 2 - (r + 0.5) * this._cell,
            0,
        );
    }

    setVisible(visible: boolean): void {
        this.node.active = visible;
        if (!visible) {
            for (const slot of [...this._cells, ...this._mirrors, ...this._ghosts, ...this._mirrorGhosts]) slot.node.active = false;
        }
    }

    playRotate(): void {
        this.node.setScale(1.05, 1.05, 1);
        tween(this.node).to(0.08, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    playLock(): void {
        this.node.setScale(1.06, 0.94, 1);
        tween(this.node).to(0.09, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }
}
