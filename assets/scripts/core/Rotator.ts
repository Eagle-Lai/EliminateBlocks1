/**
 * 旋转 + 踢墙（纯逻辑）。
 * 踢墙顺序与原型一致：同一 y 下 dx = 0,-1,+1,-2,+2；再试 y-1 的同样 5 档。
 */
import { SHAPES, type Cell } from '../config/PieceShapeTable';
import { collides, CollisionBoardLike } from './CollisionService';
import { PieceModel } from './PieceModel';

const KICKS = [0, -1, 1, -2, 2];

export function tryRotate(
    piece: PieceModel, board: CollisionBoardLike, dir: 1 | -1 = 1,
    validPose?: (cells: readonly Cell[], x: number, y: number) => boolean,
): boolean {
    const shape = SHAPES[piece.shapeIndex];
    const nextRot = (piece.rotation + 1) % 4;
    const nextCells = shape.rotations[nextRot];

    for (const dy of [0, -dir]) {
        for (const dx of KICKS) {
            const x = piece.x + dx;
            const y = piece.y + dy;
            if (!collides(board, nextCells, x, y, dir) && (!validPose || validPose(nextCells, x, y))) {
                piece.cells = nextCells.map((c) => ({ r: c.r, c: c.c }));
                piece.rotation = nextRot;
                piece.x += dx;
                piece.y += dy;
                return true;
            }
        }
    }
    return false;
}
