/**
 * 形状表：7 种四格骨牌 × 4 个旋转态。
 * 旋转规则与原型一致：{r,c} -> {c, maxR - r}，随后平移到最小行列归零。
 * 这里在模块加载时一次性展开，运行时零计算。
 */
export interface Cell {
    r: number;
    c: number;
}

export interface ShapeDef {
    id: string;
    /** rotations[0..3]，均已归一化（最小 row/col 为 0） */
    rotations: Cell[][];
    /** 原始坐标，仅用于调试展示 */
    base: Cell[];
}

const BASE_SHAPES: Cell[][] = [
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }], // I
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }], // O
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }], // T
    [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }], // S
    [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }], // Z
    [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }], // J
    [{ r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }], // L
];

const SHAPE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** 与原型 rotateCells 完全等价：顺时针旋转 + 归一化 */
export function rotateCellsClockwise(cells: Cell[]): Cell[] {
    let maxR = 0;
    for (const p of cells) maxR = Math.max(maxR, p.r);
    const rotated = cells.map((p) => ({ r: p.c, c: maxR - p.r }));
    let minR = Number.MAX_SAFE_INTEGER;
    let minC = Number.MAX_SAFE_INTEGER;
    for (const p of rotated) {
        minR = Math.min(minR, p.r);
        minC = Math.min(minC, p.c);
    }
    return rotated.map((p) => ({ r: p.r - minR, c: p.c - minC }));
}

function buildRotations(base: Cell[]): Cell[][] {
    const states: Cell[][] = [base];
    for (let i = 1; i < 4; i++) {
        states.push(rotateCellsClockwise(states[i - 1]));
    }
    return states;
}

export const SHAPES: readonly ShapeDef[] = BASE_SHAPES.map((base, i) => ({
    id: SHAPE_NAMES[i],
    base,
    rotations: buildRotations(base),
}));

export function shapeWidth(cells: readonly Cell[]): number {
    let maxC = 0;
    for (const p of cells) maxC = Math.max(maxC, p.c);
    return maxC + 1;
}

export function shapeHeight(cells: readonly Cell[]): number {
    let maxR = 0;
    for (const p of cells) maxR = Math.max(maxR, p.r);
    return maxR + 1;
}
