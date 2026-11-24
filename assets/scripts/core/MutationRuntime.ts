/**
 * 异变运行时：把 8 条异变规则落成对棋盘的纯逻辑操作。
 * 所有方法都不依赖引擎，可直接在 Node 单测里跑。
 *
 * 约定：每条异变只在 lock() 的固定时序点被调用一次，控制器负责表现。
 */
import type { BlockData, BoardModel } from './BoardModel';
import type { Cell } from '../config/PieceShapeTable';
import { mutationById, type MutationDef, type MutationParams, type MutationTier } from '../config/MutationTable';
import type { Rng } from '../utils/Rng';

export type MutationEvent =
    | { type: 'frostRain'; row: Cell[]; pushedOut: number }
    | { type: 'brittle'; cells: Cell[] }
    | { type: 'magnet'; column: number; delta: number; shifted: boolean }
    | { type: 'backflowFlush' }
    | { type: 'fog'; rows: number };

const FROST_ROW_COLORS = -1;

export class MutationRuntime {
    readonly def: MutationDef;
    readonly params: MutationParams;
    readonly tier: MutationTier;
    /** 重力方向：1 向下，-1 向上（倒悬） */
    readonly dir: 1 | -1;
    /** 镜像副本数（0 = 无镜像） */
    readonly mirrors: number;
    /** 逆流：延迟塌陷间隔（0 = 不启用） */
    readonly deferredEvery: number;
    /** 磁力方向记忆 */
    private _magnetDir = 1;

    constructor(id: number, tier: MutationTier, private readonly rng: Rng) {
        const def = mutationById(id);
        if (!def) throw new Error(`未知异变 ${id}`);
        this.def = def;
        this.tier = tier;
        this.params = def.tiers[tier];
        this.dir = def.key === 'inverted' ? -1 : 1;
        this.mirrors = def.key === 'mirror' ? (this.params.mirrors ?? 1) : 0;
        this.deferredEvery = def.key === 'backflow' ? this.params.every : 0;
    }

    get key(): MutationDef['key'] {
        return this.def.key;
    }

    get fogRows(): number {
        return this.def.key === 'fog' ? (this.params.fogRows ?? 0) : 0;
    }

    get minGroupSize(): number {
        return this.params.minGroupSize ?? 0;
    }

    get colorCount(): number {
        return this.params.colorCount ?? 0;
    }

    /** 迷雾中是否显示该格 */
    isFogged(r: number): boolean {
        return this.fogRows > 0 && r < this.fogRows;
    }

    /**
     * 每次锁定后的异变步进。返回需要表现层处理的事件。
     * @param lockCount 本局累计锁定次数（从 1 开始）
     * @param pieceColor 当前落下的骨牌颜色（脆霜选格用）
     */
    onLock(board: BoardModel, lockCount: number, pieceColor: number): MutationEvent[] {
        const events: MutationEvent[] = [];
        const every = this.params.every;

        switch (this.def.key) {
            case 'frostRain': {
                if (every <= 0 || lockCount % every !== 0) break;
                const gaps = this.params.gaps ?? 2;
                const row = this._buildFrostRow(board.cols, gaps);
                const pushedOut = board.insertBottomRow(row, 1);
                events.push({ type: 'frostRain', row: this._rowCells(board, board.rows - 1), pushedOut });
                break;
            }
            case 'brittle': {
                if (every <= 0 || lockCount % every !== 0) break;
                const cells = this._freezeRandom(board, this.params.brittleCount ?? 2);
                if (cells.length > 0) events.push({ type: 'brittle', cells });
                break;
            }
            case 'magnet': {
                if (every <= 0 || lockCount % every !== 0) break;
                const column = this.rng.int(board.cols);
                const shifted = this._shiftColumn(board, column, this._magnetDir);
                if (!shifted) this._magnetDir = (-this._magnetDir) as 1 | -1;
                events.push({ type: 'magnet', column, delta: this._magnetDir, shifted });
                break;
            }
            case 'backflow': {
                if (every > 0 && lockCount % every === 0) events.push({ type: 'backflowFlush' });
                break;
            }
            case 'fog': {
                events.push({ type: 'fog', rows: this.fogRows });
                break;
            }
            default:
                break;
        }
        return events;
    }

    /** 霜雨行：默认石块，留 gaps 个缺口 */
    private _buildFrostRow(cols: number, gaps: number): (BlockData | null)[] {
        const row: (BlockData | null)[] = [];
        for (let c = 0; c < cols; c++) row.push({ type: FROST_ROW_COLORS, pid: -1, kind: 'stone' });
        const holes = Math.max(1, Math.min(cols - 1, gaps));
        const used = new Set<number>();
        let guard = 0;
        while (used.size < holes && guard < 200) {
            guard++;
            used.add(this.rng.int(cols));
        }
        for (const c of used) row[c] = null;
        return row;
    }

    private _rowCells(board: BoardModel, r: number): Cell[] {
        const out: Cell[] = [];
        for (let c = 0; c < board.cols; c++) {
            if (board.get(r, c)) out.push({ r, c });
        }
        return out;
    }

    /** 随机把普通块变成脆霜 */
    private _freezeRandom(board: BoardModel, count: number): Cell[] {
        const candidates: Cell[] = [];
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.cols; c++) {
                const b = board.get(r, c);
                if (b && (b.kind ?? 'normal') === 'normal') candidates.push({ r, c });
            }
        }
        const out: Cell[] = [];
        for (let i = 0; i < count && candidates.length > 0; i++) {
            const idx = this.rng.int(candidates.length);
            const cell = candidates.splice(idx, 1)[0];
            const b = board.get(cell.r, cell.c);
            if (!b) continue;
            board.set(cell.r, cell.c, { type: -1, pid: -1, kind: 'brittle' });
            out.push(cell);
        }
        return out;
    }

    /** 整列横移；目标列被占用则失败 */
    private _shiftColumn(board: BoardModel, c: number, delta: number): boolean {
        const target = c + delta;
        if (target < 0 || target >= board.cols) return false;
        for (let r = 0; r < board.rows; r++) {
            if (board.get(r, c) && board.get(r, target)) return false;
        }
        for (let r = 0; r < board.rows; r++) {
            const b = board.get(r, c);
            if (!b) continue;
            board.set(r, target, b);
            board.set(r, c, null);
        }
        return true;
    }

    /**
     * 脆霜碎裂：被消除格子的 4 邻接脆霜一起碎掉。
     * 返回实际碎掉的格子（供计分/目标统计）。
     */
    breakAdjacentBrittle(board: BoardModel, removed: readonly Cell[]): Cell[] {
        if (this.def.key !== 'brittle') return [];
        const broken: Cell[] = [];
        const seen = new Set<string>();
        for (const cell of removed) {
            const around = [
                { r: cell.r - 1, c: cell.c },
                { r: cell.r + 1, c: cell.c },
                { r: cell.r, c: cell.c - 1 },
                { r: cell.r, c: cell.c + 1 },
            ];
            for (const p of around) {
                const b = board.get(p.r, p.c);
                if (!b || b.kind !== 'brittle') continue;
                const key = `${p.r},${p.c}`;
                if (seen.has(key)) continue;
                seen.add(key);
                board.set(p.r, p.c, null);
                broken.push(p);
            }
        }
        return broken;
    }

    /** 镜像落点：把骨牌水平翻转并给出镜像的 x（不修改入参） */
    mirrorOf(cells: readonly Cell[], x: number, boardCols: number): { cells: Cell[]; x: number } {
        let maxC = 0;
        for (const cell of cells) maxC = Math.max(maxC, cell.c);
        return {
            cells: cells.map((cell) => ({ r: cell.r, c: maxC - cell.c })),
            x: boardCols - 1 - (x + maxC),
        };
    }
}
