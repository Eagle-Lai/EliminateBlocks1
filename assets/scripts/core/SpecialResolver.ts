/**
 * 特殊块触发结算（纯逻辑）。
 * 只处理"被消除的格子里带特殊块"的情况：条纹清整行/列、炸弹 3×3、
 * 十字整行+整列、彩虹清盘面最多的颜色、棱镜把周围 8 格染成自身色（不消除）。
 */
import type { BoardModel, SpecialKind } from './BoardModel';
import type { Cell } from '../config/PieceShapeTable';

export interface SpecialTrigger {
    at: Cell;
    special: SpecialKind;
    /** 本次由该特殊块新增的清除格（不含原集合） */
    extra: Cell[];
}

export interface ExpandResult {
    /** 合并后的完整清除格集合 */
    cells: Cell[];
    triggers: SpecialTrigger[];
    /** 棱镜染色：格子 + 目标颜色 */
    recolors: { cell: Cell; type: number }[];
}

const key = (r: number, c: number) => `${r},${c}`;

function rowCells(board: BoardModel, r: number): Cell[] {
    const out: Cell[] = [];
    for (let c = 0; c < board.cols; c++) out.push({ r, c });
    return out;
}

function colCells(board: BoardModel, c: number): Cell[] {
    const out: Cell[] = [];
    for (let r = 0; r < board.rows; r++) out.push({ r, c });
    return out;
}

function boxCells(board: BoardModel, r: number, c: number, radius: number): Cell[] {
    const out: Cell[] = [];
    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            if (board.inBounds(r + dr, c + dc)) out.push({ r: r + dr, c: c + dc });
        }
    }
    return out;
}

/** 盘面数量最多的颜色（平票取色号最小） */
export function dominantColor(board: BoardModel): number {
    const counts = board.countByColor();
    let bestType = 0;
    let bestCount = -1;
    for (let i = 0; i < counts.length; i++) {
        const n = counts[i] ?? 0;
        if (n > bestCount) {
            bestCount = n;
            bestType = i;
        }
    }
    return bestType;
}

function areaFor(board: BoardModel, special: SpecialKind, at: Cell): Cell[] {
    switch (special) {
        case 'stripeH':
            return rowCells(board, at.r);
        case 'stripeV':
            return colCells(board, at.c);
        case 'bomb':
            return boxCells(board, at.r, at.c, 1);
        case 'cross':
            return [...rowCells(board, at.r), ...colCells(board, at.c)];
        case 'rainbow': {
            const target = dominantColor(board);
            const out: Cell[] = [];
            for (let r = 0; r < board.rows; r++) {
                for (let c = 0; c < board.cols; c++) {
                    const b = board.get(r, c);
                    if (b && b.type === target && b.kind !== 'stone') out.push({ r, c });
                }
            }
            return out;
        }
        case 'prism':
            return boxCells(board, at.r, at.c, 1);
        default:
            return [];
    }
}

/**
 * 把一次消除扩展成"含特殊块连锁"的完整集合。
 * 原集合里的特殊块会触发；新纳入的格子里若也有特殊块，继续连锁（最多 4 层防御）。
 */
export function expandSpecial(board: BoardModel, base: readonly Cell[]): ExpandResult {
    const seen = new Set<string>();
    const cells: Cell[] = [];
    const add = (cell: Cell): boolean => {
        const k = key(cell.r, cell.c);
        if (seen.has(k)) return false;
        const block = board.get(cell.r, cell.c);
        if (!block) return false;
        seen.add(k);
        cells.push({ r: cell.r, c: cell.c });
        return true;
    };
    for (const cell of base) add(cell);

    const triggers: SpecialTrigger[] = [];
    const recolors: { cell: Cell; type: number }[] = [];
    const fired = new Set<string>();
    let guard = 0;

    for (let i = 0; i < cells.length && guard < 4000; i++, guard++) {
        const cell = cells[i];
        const block = board.get(cell.r, cell.c);
        if (!block || !block.special) continue;
        const k = key(cell.r, cell.c);
        if (fired.has(k)) continue;
        fired.add(k);

        const special = block.special;
        const area = areaFor(board, special, cell);
        const extra: Cell[] = [];

        if (special === 'prism') {
            for (const p of area) {
                const nb = board.get(p.r, p.c);
                if (!nb || nb.kind === 'stone' || nb.kind === 'brittle') continue;
                if (p.r === cell.r && p.c === cell.c) continue;
                recolors.push({ cell: p, type: block.type });
            }
            triggers.push({ at: cell, special, extra: area });
            continue;
        }

        for (const p of area) {
            const nb = board.get(p.r, p.c);
            if (!nb) continue;
            // 石块只能被炸弹/十字清掉，条纹与彩虹不破坏石块（保留谜题意义）
            if (nb.kind === 'stone' && (special === 'stripeH' || special === 'stripeV' || special === 'rainbow')) {
                continue;
            }
            if (add(p)) extra.push({ r: p.r, c: p.c });
        }
        triggers.push({ at: cell, special, extra });
    }

    return { cells, triggers, recolors };
}

/** 盘面上未触发的特殊块数量 */
export function countSpecials(board: BoardModel): number {
    let n = 0;
    for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
            const b = board.get(r, c);
            if (b && b.special) n++;
        }
    }
    return n;
}

/** 找到最早生成的特殊块（用于上限 2 时移除最早的一个） */
export function oldestSpecial(board: BoardModel, order: readonly string[]): Cell | null {
    for (const k of order) {
        const [r, c] = k.split(',').map((v) => Number(v));
        const b = board.get(r, c);
        if (b && b.special) return { r, c };
    }
    return null;
}
