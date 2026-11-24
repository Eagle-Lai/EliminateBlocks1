/**
 * 当前骨牌视图：4 个方块 + 4 个落点虚影。
 * 位置完全由 PieceModel 推导，不做插值（保持"格子手感"），仅旋转/锁定有轻微形变反馈。
 */
import { _decorator, Color, Component, Graphics, Node, SpriteFrame, Vec3, tween } from 'cc';
import { THEME } from '../config/ThemeConfig';
import type { PieceModel } from '../core/PieceModel';
import { BlockView } from './BlockView';
import { createNode, setSize } from '../ui/UIFactory';

const { ccclass } = _decorator;

@ccclass('PieceView')
export class PieceView extends Component {
    private _blocks: BlockView[] = [];
    private _ghosts: Node[] = [];
    private _cell = 60;
    private _boardW = 600;
    private _boardH = 960;
    private _frames: (SpriteFrame | null)[] = [];
    /** 当前虚影颜色，避免每次移动都重画 Graphics */
    private _ghostType = -1;

    init(frames: (SpriteFrame | null)[]): void {
        this._frames = frames;
        for (let i = 0; i < 4; i++) {
            this._blocks.push(new BlockView(this.node, `PieceCell_${i}`));
            const ghost = createNode(`GhostCell_${i}`, this.node);
            ghost.addComponent(Graphics);
            this._ghosts.push(ghost);
        }
        this.setVisible(false);
    }

    layout(cell: number, boardW: number, boardH: number): void {
        this._cell = cell;
        this._boardW = boardW;
        this._boardH = boardH;
        for (const block of this._blocks) block.setCellSize(cell);
        for (const ghost of this._ghosts) {
            setSize(ghost, cell, cell);
            this._drawGhost(ghost, cell, Math.max(0, this._ghostType));
        }
    }

    /**
     * 落点虚影：同色淡填充 + 更实的描边。
     * 纯白描边在奶白色空格上几乎看不见（对比度不足 5%），所以用骨牌色做双通道提示。
     */
    private _drawGhost(node: Node, cell: number, type: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        const color = THEME.blockColors[type] ?? THEME.blockColors[0];
        const size = cell * 0.82;
        const radius = size * 0.22;
        g.clear();
        g.fillColor = new Color(color.r, color.g, color.b, 58);
        g.roundRect(-size / 2, -size / 2, size, size, radius);
        g.fill();
        g.lineWidth = Math.max(2, cell * 0.07);
        g.strokeColor = new Color(color.r, color.g, color.b, 200);
        g.roundRect(-size / 2, -size / 2, size, size, radius);
        g.stroke();
    }

    sync(piece: PieceModel, ghostY: number): void {
        this.setVisible(true);
        if (piece.color !== this._ghostType) {
            this._ghostType = piece.color;
            for (const ghost of this._ghosts) this._drawGhost(ghost, this._cell, this._ghostType);
        }
        for (let i = 0; i < 4; i++) {
            const block = this._blocks[i];
            const ghost = this._ghosts[i];
            const cellData = piece.cells[i];
            if (!cellData) {
                block.setVisible(false);
                ghost.active = false;
                continue;
            }
            const r = piece.y + cellData.r;
            const c = piece.x + cellData.c;

            block.setVisible(true);
            block.applyType(piece.color, this._frames[piece.color] ?? null);
            block.setCellPos(r, c, this._boardW, this._boardH, this._cell);

            const gr = ghostY + cellData.r;
            ghost.active = gr >= 0;
            if (gr >= 0) {
                ghost.setPosition(
                    -this._boardW / 2 + (c + 0.5) * this._cell,
                    this._boardH / 2 - (gr + 0.5) * this._cell,
                    0,
                );
            }
        }
    }

    setVisible(visible: boolean): void {
        for (const block of this._blocks) block.setVisible(visible);
        for (const ghost of this._ghosts) ghost.active = false;
        this.node.active = visible;
    }

    playRotate(): void {
        this.node.setScale(1.05, 1.05, 1);
        tween(this.node)
            .to(0.08, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    playLock(): void {
        this.node.setScale(1.06, 0.94, 1);
        tween(this.node)
            .to(0.09, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }
}

/** 供外部计算虚影位置 */
export function ghostRow(
    piece: PieceModel,
    collidesFn: (cells: typeof piece.cells, x: number, y: number) => boolean,
): number {
    let y = piece.y;
    while (!collidesFn(piece.cells, piece.x, y + 1)) y++;
    return y;
}
