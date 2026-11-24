/**
 * 棋盘数据模型（纯数据，不依赖引擎）。
 * grid[row][col]，row 0 为顶部；null 表示空格。
 */
import type { Cell } from '../config/PieceShapeTable';

/** 普通块之外的阻挡块类型 */
export type BlockKind = 'normal' | 'stone' | 'brittle';
/** 特殊块类型（与 SpecialBlockTable 一一对应） */
export type SpecialKind = 'stripeH' | 'stripeV' | 'rainbow' | 'bomb' | 'cross' | 'prism';

export interface BlockData {
    /** 颜色索引 0..colorCount-1；石块固定 -1 */
    type: number;
    /** 所属骨牌 id，用于「至少两个不同骨牌」的判定；石块 -1 */
    pid: number;
    /** 缺省为普通块，保证旧存档 / 旧调用方兼容 */
    kind?: BlockKind;
    /** 特殊块标记；生成后继承锚点颜色 */
    special?: SpecialKind;
}

export interface DropMove {
    fromR: number;
    fromC: number;
    toR: number;
    toC: number;
    block: BlockData;
}

export class BoardModel {
    readonly cols: number;
    readonly rows: number;
    private _grid: (BlockData | null)[][] = [];

    constructor(cols: number, rows: number) {
        this.cols = cols;
        this.rows = rows;
        this.reset();
    }

    reset(): void {
        this._grid = [];
        for (let r = 0; r < this.rows; r++) {
            const row: (BlockData | null)[] = new Array(this.cols).fill(null);
            this._grid.push(row);
        }
    }

    get grid(): readonly (BlockData | null)[][] {
        return this._grid;
    }

    inBounds(r: number, c: number): boolean {
        return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    get(r: number, c: number): BlockData | null {
        if (!this.inBounds(r, c)) return null;
        return this._grid[r][c];
    }

    set(r: number, c: number, block: BlockData | null): void {
        if (!this.inBounds(r, c)) return;
        this._grid[r][c] = block;
    }

    isEmpty(r: number, c: number): boolean {
        return this.get(r, c) === null;
    }

    /** 清空指定格 */
    removeCells(cells: readonly Cell[]): number {
        let removed = 0;
        for (const cell of cells) {
            if (this.inBounds(cell.r, cell.c) && this._grid[cell.r][cell.c]) {
                this._grid[cell.r][cell.c] = null;
                removed++;
            }
        }
        return removed;
    }

    /** 找出所有被填满的行（自上而下） */
    fullRows(): number[] {
        const rows: number[] = [];
        for (let r = 0; r < this.rows; r++) {
            let full = true;
            for (let c = 0; c < this.cols; c++) {
                if (!this._grid[r][c]) {
                    full = false;
                    break;
                }
            }
            if (full) rows.push(r);
        }
        return rows;
    }

    /**
     * 整行压缩（与原型 clearRows 等价）：dir=1 向下压实（保留下来的行从底部往上重排）；
     * dir=-1 向上压实（倒悬玩法）。
     */
    clearRows(rows: readonly number[], dir: 1 | -1 = 1): void {
        const dead = new Set(rows);
        const next: (BlockData | null)[][] = [];
        for (let r = 0; r < this.rows; r++) {
            next.push(new Array(this.cols).fill(null));
        }
        if (dir === 1) {
            let write = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (dead.has(r)) continue;
                next[write] = this._grid[r];
                write--;
            }
        } else {
            let write = 0;
            for (let r = 0; r < this.rows; r++) {
                if (dead.has(r)) continue;
                next[write] = this._grid[r];
                write++;
            }
        }
        this._grid = next;
    }

    /**
     * 从底部（dir=1）或顶部（dir=-1）插入一整行，整盘向另一侧平移。
     * row 长度不足时右侧补 null。返回被挤出棋盘的方块数（用于判负）。
     */
    insertBottomRow(row: readonly (BlockData | null)[], dir: 1 | -1 = 1): number {
        let pushed = 0;
        if (dir === 1) {
            const overflow = this._grid[0];
            for (let c = 0; c < this.cols; c++) if (overflow[c]) pushed++;
            for (let r = 0; r < this.rows - 1; r++) this._grid[r] = this._grid[r + 1];
            const last: (BlockData | null)[] = new Array(this.cols).fill(null);
            for (let c = 0; c < this.cols; c++) last[c] = row[c] ?? null;
            this._grid[this.rows - 1] = last;
        } else {
            const overflow = this._grid[this.rows - 1];
            for (let c = 0; c < this.cols; c++) if (overflow[c]) pushed++;
            for (let r = this.rows - 1; r > 0; r--) this._grid[r] = this._grid[r - 1];
            const first: (BlockData | null)[] = new Array(this.cols).fill(null);
            for (let c = 0; c < this.cols; c++) first[c] = row[c] ?? null;
            this._grid[0] = first;
        }
        return pushed;
    }

    /** 各颜色普通块数量（特殊块统计颜色、石块不计） */
    countByColor(): number[] {
        const counts: number[] = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const b = this._grid[r][c];
                if (!b || b.kind === 'stone' || b.type < 0) continue;
                counts[b.type] = (counts[b.type] ?? 0) + 1;
            }
        }
        return counts;
    }

    /** 统计指定 kind 的数量 */
    countKind(kind: BlockKind): number {
        let n = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const b = this._grid[r][c];
                if (b && (b.kind ?? 'normal') === kind) n++;
            }
        }
        return n;
    }

    /** 统计当前所有方块数 */
    blockCount(): number {
        let n = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this._grid[r][c]) n++;
            }
        }
        return n;
    }

    /** 深拷贝（求解器 / 撤销快照用，保留对象身份在副本内部一致） */
    clone(): BoardModel {
        const copy = new BoardModel(this.cols, this.rows);
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const b = this._grid[r][c];
                copy._grid[r][c] = b ? { ...b } : null;
            }
        }
        return copy;
    }

    /**
     * 从字符画构造：'.' 空；'0'..'4' 颜色；'S' 石块；'B' 脆霜。
     * 行数/列数必须与模型一致（用于每日残局与单测）。
     */
    static fromPattern(rows: readonly string[]): BoardModel {
        const h = rows.length;
        const w = h > 0 ? rows[0].length : 0;
        const board = new BoardModel(w, h);
        let pid = 1000;
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                const ch = rows[r][c];
                if (!ch || ch === '.') continue;
                if (ch === 'S') board.set(r, c, { type: -1, pid: -1, kind: 'stone' });
                else if (ch === 'B') board.set(r, c, { type: -1, pid: -1, kind: 'brittle' });
                else board.set(r, c, { type: Number(ch), pid: pid++ });
            }
        }
        return board;
    }

    /** 调试快照：数字表示颜色，'S' 石块，'B' 脆霜，'.' 空 */
    dump(): string {
        const lines: string[] = [];
        for (let r = 0; r < this.rows; r++) {
            let line = '';
            for (let c = 0; c < this.cols; c++) {
                const b = this._grid[r][c];
                if (!b) line += '.';
                else if (b.kind === 'stone') line += 'S';
                else if (b.kind === 'brittle') line += 'B';
                else line += String(b.type);
            }
            lines.push(line);
        }
        return lines.join('\n');
    }
}
