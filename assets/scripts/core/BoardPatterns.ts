/**
 * 开局盘面构造（纯逻辑，确定性）。
 * 石块关：底部 2 行铺石块，数量 = target + 2，留 2 个缺口。
 */
import { Rng } from '../utils/Rng';

export function buildStoneBoard(
    seed: number,
    stoneCount: number,
    cols = 10,
    rows = 16,
    gaps = 2,
): string[] {
    const rng = new Rng(seed);
    const grid: string[][] = [];
    for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill('.'));

    const bottom = [rows - 1, rows - 2];
    const holes = Math.max(1, Math.min(4, gaps));
    // 每行至少留 holes 个缺口：否则整行填满会在第一次结算时被"消行"清空，
    // 石块关会变成白送（这是内容校验里发现的问题）。
    const holeSet = new Set<string>();
    for (const r of bottom) {
        const colsIdx: number[] = [];
        for (let c = 0; c < cols; c++) colsIdx.push(c);
        for (let i = colsIdx.length - 1; i > 0; i--) {
            const j = rng.int(i + 1);
            const tmp = colsIdx[i];
            colsIdx[i] = colsIdx[j];
            colsIdx[j] = tmp;
        }
        for (let i = 0; i < holes; i++) holeSet.add(`${r},${colsIdx[i]}`);
    }

    let placed = 0;
    for (const r of bottom) {
        for (let c = 0; c < cols; c++) {
            if (placed >= stoneCount) break;
            if (holeSet.has(`${r},${c}`)) continue;
            grid[r][c] = 'S';
            placed++;
        }
    }

    return grid.map((row) => row.join(''));
}
