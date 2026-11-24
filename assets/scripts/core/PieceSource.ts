/**
 * 出牌源：无尽用随机（PieceFactory），关卡/残局用固定队列。
 * 面试题式的关键点：同一种子 → 同一序列，回放与每日挑战才能复现。
 */
import { SHAPES, shapeWidth, type Cell } from '../config/PieceShapeTable';
import { PieceModel } from './PieceModel';
import type { Rng } from '../utils/Rng';

export interface PieceSpec {
    shape: number;
    color: number;
    /** 固定初始列（缺省居中） */
    x?: number;
}

export interface PieceSource {
    /** 取下一块；耗尽返回 null（残局步数用尽） */
    next(): PieceModel | null;
    /** 剩余数量；Infinity 表示无限 */
    readonly remaining: number;
    reset(): void;
}

/** 固定队列（每日残局 / 关卡开场） */
export class QueuePieceSource implements PieceSource {
    private _index = 0;
    private _pid = 0;

    constructor(
        private readonly queue: readonly PieceSpec[],
        private readonly cols: number,
    ) {}

    get remaining(): number {
        return Math.max(0, this.queue.length - this._index);
    }

    get index(): number {
        return this._index;
    }

    reset(): void {
        this._index = 0;
        this._pid = 0;
    }

    next(): PieceModel | null {
        if (this._index >= this.queue.length) return null;
        const spec = this.queue[this._index++];
        return QueuePieceSource.build(spec, this.cols, ++this._pid);
    }

    static build(spec: PieceSpec, cols: number, pid: number): PieceModel {
        const shapeIndex = ((spec.shape % SHAPES.length) + SHAPES.length) % SHAPES.length;
        const shape = SHAPES[shapeIndex];
        const piece = new PieceModel();
        piece.shapeIndex = shapeIndex;
        piece.rotation = 0;
        piece.cells = shape.rotations[0].map((c) => ({ r: c.r, c: c.c }));
        piece.color = spec.color;
        piece.pid = pid;
        piece.x = spec.x ?? Math.floor((cols - shapeWidth(piece.cells)) / 2);
        piece.y = 0;
        return piece;
    }
}

/** 从种子生成一份可复现的出牌队列（关卡用；与无尽随机序列同构） */
export function generateQueue(rng: Rng, count: number, colorCount: number): PieceSpec[] {
    const out: PieceSpec[] = [];
    for (let i = 0; i < count; i++) {
        out.push({ shape: rng.int(SHAPES.length), color: rng.int(colorCount) });
    }
    return out;
}

/** 旋转后的相对格（用于求解器枚举落点） */
export function rotationCells(shapeIndex: number, rotation: number): Cell[] {
    const shape = SHAPES[shapeIndex % SHAPES.length];
    const rot = ((rotation % 4) + 4) % 4;
    return shape.rotations[rot].map((c) => ({ r: c.r, c: c.c }));
}
