/**
 * 棋盘数据模型（纯数据，不依赖引擎）。
 * grid[row][col]，row 0 为顶部；null 表示空格。
 */
import type { Cell } from '../config/PieceShapeTable';

export interface BlockData {
    /** 颜色索引 0..colorCount-1 */
    type: number;
    /** 所属骨牌 id，用于「至少两个不同骨牌」的判定 */
    pid: number;
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
     * 整行下移压缩（与原型 clearRows 等价）：
     * 保留下来的行按原顺序从底部往上重新摆放。
     */
    clearRows(rows: readonly number[]): void {
        const dead = new Set(rows);
        const next: (BlockData | null)[][] = [];
        for (let r = 0; r < this.rows; r++) {
            next.push(new Array(this.cols).fill(null));
        }
        let write = this.rows - 1;
        for (let r = this.rows - 1; r >= 0; r--) {
            if (dead.has(r)) continue;
            next[write] = this._grid[r];
            write--;
        }
        this._grid = next;
    }

    /** 统计当前方块数（调试/压测用） */
    blockCount(): number {
        let n = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this._grid[r][c]) n++;
            }
        }
        return n;
    }

    /** 调试快照：'R' 表示红… '-' 表示空 */
    dump(): string {
        const lines: string[] = [];
        for (let r = 0; r < this.rows; r++) {
            let line = '';
            for (let c = 0; c < this.cols; c++) {
                const b = this._grid[r][c];
                line += b ? String(b.type) : '.';
            }
            lines.push(line);
        }
        return lines.join('\n');
    }
}
