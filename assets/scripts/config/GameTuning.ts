/**
 * 全局数值配置 —— 所有魔法数字的唯一来源。
 * 修改玩法手感只需改这里，不允许在业务代码里出现裸数字。
 */
export const TUNING = {
    board: {
        cols: 10,
        rows: 16,
        colorCount: 5,
    },
    speed: {
        startMs: 850,
        stepMs: 60,
        minMs: 130,
    },
    score: {
        /** 组基础分 = size * (size + 1) / 2 * groupPair */
        groupPair: 15,
        /** 连锁倍率 = 1 + (chain - 1) * chainStep */
        chainStep: 0.5,
        /** 整行清除 = 行数 * rowClear * 等级 */
        rowClear: 200,
    },
    level: {
        /** 升级阈值 = level * threshold */
        threshold: 1500,
    },
    settle: {
        /** 单次结算最大迭代次数（防御性上限） */
        maxIterations: 24,
        popMs: 150,
        dropMs: 190,
        rowFadeMs: 180,
        rowShiftMs: 200,
        /** 看门狗：结算超时强制收尾 */
        watchdogMs: 2500,
    },
    input: {
        tapMaxMs: 420,
        tapMaxCellRatio: 0.45,
        holdDelayMs: 250,
        holdRepeatMs: 90,
        /** 单帧 dt 上限，防止切后台回来瞬移 */
        frameClampMs: 80,
        /** 按钮防连点间隔 */
        buttonCooldownMs: 120,
    },
    rules: {
        requireTwoPieces: true,
        minGroupSize: 3,
        /** 锁定后若有格子位于棋盘上方则判负（原型为静默丢弃） */
        gameOverOnLockAboveTop: true,
        confirmRestart: true,
    },
    fx: {
        shakeOnChain: true,
        burstCount: 8,
        floatRisePx: 42,
        popDurationMs: 700,
    },
    ui: {
        designWidth: 750,
        /** 竖屏基准设计尺寸：窗口比它更"宽/矮"时，画布收成这个比例的竖屏框 */
        designHeight: 1334,
        /** 画布铺满窗口时（手机/竖屏窗口）设计高宽比的上限，超出按此兜底 */
        maxAspect: 2.3,
        margin: 24,
        topBarHeight: 138,
        padHeight: 172,
        hintHeight: 40,
        cellMin: 36,
        cellMax: 78,
        radiusCard: 24,
        radiusButton: 24,
    },
} as const;

export type TuningType = typeof TUNING;
