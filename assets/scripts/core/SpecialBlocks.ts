/**
 * 特殊块生成规则（纯逻辑）。
 * 判定顺序：≥6 → 5 共线 → 5 十字 → 5 非共线 → 4 共线 → 无。
 * 生成位置：最后一个落点格（不在组内时取组内离它最近的格）。
 */
import type { BlockData, BoardModel, SpecialKind } from './BoardModel';
import type { Cell } from '../config/PieceShapeTable';
import type { GroupInfo } from './MatchFinder';
import { groupLineAxis } from './MatchFinder';

export interface SpecialSpawn {
    cell: Cell;
    special: SpecialKind;
    type: number;
    pid: number;
}

function isCross(cells: readonly Cell[]): boolean {
    if (cells.length !== 5) return false;
    const key = (r: number, c: number) => `${r},${c}`;
    const set = new Set(cells.map((p) => key(p.r, p.c)));
    for (const p of cells) {
        const h = (set.has(key(p.r, p.c - 1)) ? 1 : 0) + (set.has(key(p.r, p.c + 1)) ? 1 : 0);
        const v = (set.has(key(p.r - 1, p.c)) ? 1 : 0) + (set.has(key(p.r + 1, p.c)) ? 1 : 0);
        if (h === 2 && v === 2) return true;
    }
    return false;
}

/** 单组 → 特殊块类型；null 表示不生成 */
export function specialForGroup(group: GroupInfo): SpecialKind | null {
    const axis = groupLineAxis(group.cells);
    if (group.size >= 6) return 'prism';
    if (group.size === 5 && axis) return 'rainbow';
    if (group.size === 5 && isCross(group.cells)) return 'cross';
    if (group.size === 5) return 'bomb';
    if (group.size === 4 && axis) return axis === 'h' ? 'stripeH' : 'stripeV';
    return null;
}

function nearestCell(cells: readonly Cell[], anchor: Cell): Cell {
    let best = cells[0];
    let bestDist = Number.MAX_SAFE_INTEGER;
    for (const p of cells) {
        const d = Math.abs(p.r - anchor.r) + Math.abs(p.c - anchor.c);
        if (d < bestDist) {
            bestDist = d;
            best = p;
        }
    }
    return best;
}

/**
 * 从本次消除的组里规划特殊块。
 * @param board 用于取锚点颜色
 * @param groups 本次消除组
 * @param anchor 最后落点（骨牌落点格）
 */
export function planSpecials(
    board: BoardModel,
    groups: readonly GroupInfo[],
    anchor: Cell,
    allow: boolean,
): SpecialSpawn[] {
    if (!allow) return [];
    const out: SpecialSpawn[] = [];
    const used = new Set<string>();
    for (const group of groups) {
        const special = specialForGroup(group);
        if (!special) continue;
        const inGroup = group.cells.some((p) => p.r === anchor.r && p.c === anchor.c);
        const cell = inGroup ? anchor : nearestCell(group.cells, anchor);
        const key = `${cell.r},${cell.c}`;
        if (used.has(key)) continue;
        used.add(key);
        const block = board.get(cell.r, cell.c);
        if (!block) continue;
        out.push({ cell, special, type: block.type, pid: block.pid });
    }
    return out;
}

/** 把生成的特殊块写回棋盘（在 removeCells 之后调用） */
export function writeSpecials(board: BoardModel, spawns: readonly SpecialSpawn[]): void {
    for (const spawn of spawns) {
        const block: BlockData = {
            type: spawn.type,
            pid: spawn.pid,
            special: spawn.special,
        };
        board.set(spawn.cell.r, spawn.cell.c, block);
    }
}
