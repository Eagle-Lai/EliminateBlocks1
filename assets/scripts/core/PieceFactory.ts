/**
 * 骨牌生成器：形状与颜色各自独立均匀随机（与原型一致，无 7-bag）。
 * 通过注入 Rng 实现可复现对局。
 */
import { SHAPES, shapeWidth } from '../config/PieceShapeTable';
import { PieceModel } from './PieceModel';
import { Rng } from '../utils/Rng';

export class PieceFactory {
    private _seq = 0;

    constructor(
        private readonly rng: Rng,
        private readonly cols: number,
        private readonly colorCount: number,
    ) {}

    reset(): void {
        this._seq = 0;
    }

    get lastPid(): number {
        return this._seq;
    }

    create(): PieceModel {
        const shapeIndex = this.rng.int(SHAPES.length);
        const color = this.rng.int(this.colorCount);
        const shape = SHAPES[shapeIndex];

        const piece = new PieceModel();
        piece.shapeIndex = shapeIndex;
        piece.rotation = 0;
        piece.cells = shape.rotations[0].map((c) => ({ r: c.r, c: c.c }));
        piece.color = color;
        piece.pid = ++this._seq;
        piece.x = Math.floor((this.cols - shapeWidth(piece.cells)) / 2);
        piece.y = 0;
        return piece;
    }

    /** 生成指定形状（单测 / 调试用） */
    createByShape(shapeIndex: number, color = 0): PieceModel {
        const shape = SHAPES[shapeIndex % SHAPES.length];
        const piece = new PieceModel();
        piece.shapeIndex = shapeIndex % SHAPES.length;
        piece.cells = shape.rotations[0].map((c) => ({ r: c.r, c: c.c }));
        piece.color = color;
        piece.pid = ++this._seq;
        piece.x = Math.floor((this.cols - shapeWidth(piece.cells)) / 2);
        piece.y = 0;
        return piece;
    }
}
