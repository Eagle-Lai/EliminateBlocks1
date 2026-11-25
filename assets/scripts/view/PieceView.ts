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
    private _cell = 60;
    private _boardW = 600;
    private _boardH = 960;

    init(frames: (SpriteFrame | null)[]): void {
        this._frames = frames;
        for (let i = 0; i < 4; i++) {
            this._cells.push(this._spawnPieceCell(this.pieceLayer, `Piece_${i}`));
            this._mirrors.push(this._spawnPieceCell(this.pieceLayer, `Mirror_${i}`));
            this._ghosts.push(this._spawnGhostCell(`Ghost_${i}`));
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
        for (const slot of [...this._cells, ...this._mirrors, ...this._ghosts]) {
            const ui = slot.node.getComponent(UITransform);
            if (ui) ui.setContentSize(cell * 0.96, cell * 0.96);
        }
    }

    /**
     * @param piece 当前骨牌
     * @param ghostY 落点 y（与 piece.y 同向）
     * @param dir 1 向下 / -1 向上（倒悬）
     * @param mirrorX 镜像副本的 x（null 表示不显示镜像）
     */
    sync(piece: PieceModel, ghostY: number, dir: 1 | -1 = 1, mirrorX: number | null = null): void {
        this.setVisible(true);
        const frame = this._frames[piece.color] ?? null;
        for (let i = 0; i < 4; i++) {
            const cellData = piece.cells[i];
            const slot = this._cells[i];
            const mirror = this._mirrors[i];
            const ghost = this._ghosts[i];
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
                let maxC = 0;
                for (const p of piece.cells) maxC = Math.max(maxC, p.c);
                mirror.node.active = true;
                this._place(mirror, frame, r, mirrorX + (maxC - cellData.c));
            } else {
                mirror.node.active = false;
            }

            const gr = dir === 1 ? ghostY + cellData.r : ghostY - cellData.r;
            ghost.node.active = gr >= 0 && gr < 16;
            if (ghost.node.active) {
                ghost.node.setPosition(
                    -this._boardW / 2 + (c + 0.5) * this._cell,
                    this._boardH / 2 - (gr + 0.5) * this._cell,
                    0,
                );
                const color = THEME.blockColors[piece.color] ?? THEME.blockColors[0];
                if (ghost.base) ghost.base.color = new Color(color.r, color.g, color.b, 45);
                if (ghost.extra) ghost.extra.color = THEME.accentSoft;
            }
        }
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
            for (const slot of [...this._cells, ...this._mirrors, ...this._ghosts]) slot.node.active = false;
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
