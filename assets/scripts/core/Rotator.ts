/**
 * 旋转 + 踢墙（纯逻辑）。
 * 踢墙顺序与原型一致：同一 y 下 dx = 0,-1,+1,-2,+2；再试 y-1 的同样 5 档。
 */
import { SHAPES } from '../config/PieceShapeTable';
import { collides, CollisionBoardLike } from './CollisionService';
import { PieceModel } from './PieceModel';

const KICKS = [0, -1, 1, -2, 2];

export function tryRotate(piece: PieceModel, board: CollisionBoardLike, dir: 1 | -1 = 1): boolean {
    const shape = SHAPES[piece.shapeIndex];
    const nextRot = (piece.rotation + 1) % 4;
    const nextCells = shape.rotations[nextRot];

    for (const dy of [0, -1]) {
        for (const dx of KICKS) {
            if (!collides(board, nextCells, piece.x + dx, piece.y + dy, dir)) {
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
