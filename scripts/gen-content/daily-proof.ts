import { BoardModel } from '../../assets/scripts/core/BoardModel';
import { QueuePieceSource } from '../../assets/scripts/core/PieceSource';
import { collides, findDropY } from '../../assets/scripts/core/CollisionService';
import { tryRotate } from '../../assets/scripts/core/Rotator';
import { simulateLock } from '../../assets/scripts/core/Simulator';
import { goalDelta, placementsFor } from '../../assets/scripts/core/Solver';
import { mutationById } from '../../assets/scripts/config/MutationTable';
import { TUNING } from '../../assets/scripts/config/GameTuning';
import { SugarEnergy } from '../../assets/scripts/core/SugarEnergy';
import { applyGravity } from '../../assets/scripts/core/GravityResolver';
import { findGroups } from '../../assets/scripts/core/MatchFinder';
import { SHAPES } from '../../assets/scripts/config/PieceShapeTable';
import { solutionRatioRange, type DailyPuzzleData } from '../../assets/scripts/core/DailyPuzzle';

export type Move = [rotation: number, x: number];
type Puzzle = Pick<DailyPuzzleData, 'board' | 'queue' | 'goal' | 'moveLimit' | 'mutationId'>;

/** Replay from the real spawn, rotating first and moving one column per input. */
export function replayDaily(puzzle: Puzzle, moves: Move[]): { values: number[]; cleared: boolean[] } {
    if (moves.length > puzzle.moveLimit || moves.length > puzzle.queue.length) throw Error('解答超出步数或牌序');
    const board = BoardModel.fromPattern(puzzle.board);
    const source = new QueuePieceSource(puzzle.queue, board.cols);
    const mutation = puzzle.mutationId ? mutationById(puzzle.mutationId) : null;
    const dir = mutation?.key === 'inverted' ? -1 : 1;
    const values: number[] = [];
    const cleared: boolean[] = [];
    const energy = new SugarEnergy();
    let score = 0;
    let value = 0;
    for (const [rotation, x] of moves) {
        const piece = source.next()!;
        piece.y = dir === 1 ? 0 : board.rows - 1;
        if (collides(board, piece.cells, piece.x, piece.y, dir)) throw Error('解答出生处受阻');
        if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3 || !Number.isInteger(x) || x < 0 || x >= board.cols) {
            throw Error('解答操作无效');
        }
        for (let i = 0; i < rotation; i++) {
            if (!tryRotate(piece, board, dir)) throw Error('解答旋转受阻');
        }
        while (piece.x !== x) {
            const next = piece.x + Math.sign(x - piece.x);
            if (collides(board, piece.cells, next, piece.y, dir)) throw Error('解答平移受阻');
            piece.x = next;
        }
        const y = findDropY(board, piece.cells, x, piece.y, dir);
        if (piece.cells.some(p => !board.inBounds(y + dir * p.r, x + p.c))) throw Error('解答锁定越界');
        const result = simulateLock(board, piece.cells, x, y, piece.color, piece.pid, {
            dir, specials: true, minGroupSize: mutation?.tiers.standard.minGroupSize,
            level: 1 + Math.floor(score / TUNING.level.threshold),
        });
        score += result.gain + (energy.full ? TUNING.sugar.lockBonus : 0);
        energy.add(result.removedCells, result.chainSum);
        value = puzzle.goal.type === 'score' ? score : value + goalDelta(puzzle.goal, result);
        values.push(value);
        cleared.push(result.removedCells > 0 || result.rows > 0);
    }
    return { values, cleared };
}

/** Check the shipped board and the offline witness; fail with the offending day in the caller. */
export function verifyDaily(puzzle: DailyPuzzleData, moves: Move[]): void {
    const board = BoardModel.fromPattern(puzzle.board);
    const mutation = puzzle.mutationId ? mutationById(puzzle.mutationId) : null;
    const dir = mutation?.key === 'inverted' ? -1 : 1;
    const colors = mutation?.tiers.standard.colorCount ?? TUNING.board.colorCount;
    if (puzzle.board.length !== TUNING.board.rows || puzzle.board.some(row =>
        row.length !== TUNING.board.cols || [...row].some(c => c !== '.' && c !== 'S' && !'01234'.slice(0, colors).includes(c)))) {
        throw Error('盘面尺寸或格值无效');
    }
    if (puzzle.queue.length < puzzle.moveLimit || puzzle.queue.some(q =>
        !Number.isInteger(q.shape) || !SHAPES[q.shape] || !Number.isInteger(q.color) || q.color < 0 || q.color >= colors)) {
        throw Error('牌序不足或含有无效骨牌');
    }
    if (board.fullRows().length || findGroups(board, mutation?.tiers.standard.minGroupSize ?? TUNING.rules.minGroupSize).length ||
        applyGravity(board.clone(), dir).length) throw Error('初盘存在满行、可消组或悬空格');
    const first = puzzle.queue[0];
    const center = QueuePieceSource.build(first, board.cols, 1).x;
    if (replayDaily(puzzle, [[0, center]]).cleared[0]) throw Error('居中首落触发消除');
    if (placementsFor(board, first.shape, dir, true, null, first.x).some(p => replayDaily(puzzle, [[p.rotation, p.x]]).values[0] >= puzzle.goal.target)) {
        throw Error('单次落子即可达标');
    }
    const { min, max } = solutionRatioRange(puzzle.difficulty);
    if (!Array.isArray(moves) || moves.length !== puzzle.solutionLength ||
        moves.length < puzzle.moveLimit * min || moves.length > puzzle.moveLimit * max) throw Error('参考解长度与难度不符');
    if (puzzle.hint?.shape !== first.shape || puzzle.hint.rotation !== moves[0][0] || puzzle.hint.x !== moves[0][1]) {
        throw Error('提示与参考解首步不符');
    }
    const { values } = replayDaily(puzzle, moves);
    if (values.findIndex(v => v >= puzzle.goal.target) !== moves.length - 1) throw Error('参考解未在记录步数首次达标');
}
