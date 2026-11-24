/**
 * 骨牌模型（纯数据）。
 * cells 为该旋转态下已归一化的相对坐标；x/y 为左上角在棋盘中的位置。
 */
import type { Cell } from '../config/PieceShapeTable';
import { shapeWidth, shapeHeight } from '../config/PieceShapeTable';

export class PieceModel {
    shapeIndex = 0;
    rotation = 0;
    cells: Cell[] = [];
    color = 0;
    pid = 0;
    x = 0;
    y = 0;

    get width(): number {
        return shapeWidth(this.cells);
    }

    get height(): number {
        return shapeHeight(this.cells);
    }

    /** 遍历骨牌在棋盘上的绝对坐标 */
    forEachCell(fn: (r: number, c: number, index: number) => void): void {
        for (let i = 0; i < this.cells.length; i++) {
            const p = this.cells[i];
            fn(this.y + p.r, this.x + p.c, i);
        }
    }

    clone(): PieceModel {
        const p = new PieceModel();
        p.shapeIndex = this.shapeIndex;
        p.rotation = this.rotation;
        p.cells = this.cells.map((c) => ({ r: c.r, c: c.c }));
        p.color = this.color;
        p.pid = this.pid;
        p.x = this.x;
        p.y = this.y;
        return p;
    }
}
