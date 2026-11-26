/**
 * 布局适配：把屏幕尺寸换算成「顶栏 / 棋盘 / 控制区」的具体坐标与格子边长。
 * 所有 UI 都基于这里的结果摆放，任何分辨率下不出现硬编码像素。
 */
import { view } from 'cc';
import { TUNING } from '../config/GameTuning';

export interface LayoutInfo {
    width: number;
    height: number;
    safeTop: number;
    safeBottom: number;
    /** 顶栏第一行（品牌 + 图标）中心 Y */
    headerCenterY: number;
    /** 顶栏卡片行中心 Y */
    cardsCenterY: number;
    /** 棋盘中心 Y */
    boardCenterY: number;
    boardCenterX: number;
    outerGap: number;
    boardW: number;
    boardH: number;
    cell: number;
    /** 控制区中心 Y */
    padCenterY: number;
    /** 底部提示中心 Y */
    hintCenterY: number;
    /** 顶栏卡片可用总宽 */
    contentWidth: number;
}

const HEADER_H = 52;
const HEADER_GAP = 8;
const CARDS_H = 96;
const TOP_BAR_H = HEADER_H + HEADER_GAP + CARDS_H;

export class LayoutAdapter {
    /**
     * 设计单位下的真实可视区域。
     * `SHOW_ALL` 在窗口比例宽于设计比例时会左右留边，此时相机实际渲染的范围比设计框更大，
     * 全屏元素（背景、弹窗遮罩）要按这个尺寸铺，否则留边处会露出清屏色/亮边。
     */
    static viewport(designW: number, designH: number): { width: number; height: number } {
        const frame = view.getFrameSize();
        const scale = Math.min(frame.width / designW, frame.height / designH);
        if (!(scale > 0)) return { width: designW, height: designH };
        return {
            width: Math.max(designW, Math.round(frame.width / scale)),
            height: Math.max(designH, Math.round(frame.height / scale)),
        };
    }

    static compute(width: number, height: number, safeTop: number, safeBottom: number): LayoutInfo {
        const margin = TUNING.ui.margin;
        const contentWidth = width - margin * 2;

        const top = height / 2 - safeTop;
        const bottom = -height / 2 + safeBottom;

        const headerCenterY = top - HEADER_H / 2;
        const cardsCenterY = top - HEADER_H - HEADER_GAP - CARDS_H / 2;
        const topBarBottom = top - TOP_BAR_H;

        const hintCenterY = bottom + TUNING.ui.hintHeight / 2;
        const padBottom = bottom + TUNING.ui.hintHeight;
        const padCenterY = padBottom + TUNING.ui.padHeight / 2;

        const boardTop = topBarBottom - TUNING.ui.shadowGap - 8;
        const boardBottom = padBottom + TUNING.ui.padHeight + TUNING.ui.boardPadding;
        const boardAreaH = Math.max(120, boardTop - boardBottom);

        // 棋盘和右侧糖能轨作为整体居中，左边只需为边框留空。
        const railReach = TUNING.ui.railGap + TUNING.ui.railWidth / 2;
        const frameEdge = 12;
        const boardMaxW = contentWidth - frameEdge - railReach;
        const cellByWidth = boardMaxW / TUNING.board.cols;
        const cellByHeight = (boardAreaH - 8) / TUNING.board.rows;
        // 贴图的透明边已收紧，取回约 2% 的格心距离，保留原有糖块的可见宽度。
        const slot = Math.max(
            TUNING.ui.cellMin,
            Math.min(TUNING.ui.cellMax, Math.floor(Math.min(cellByWidth, cellByHeight))),
        );

        const cell = slot * 0.98;

        return {
            width,
            height,
            safeTop,
            safeBottom,
            headerCenterY,
            cardsCenterY,
            outerGap: Math.max(0, (boardAreaH - cell * TUNING.board.rows) / 2 - 8),
            boardCenterX: (frameEdge - railReach) / 2,
            boardCenterY: (boardTop + boardBottom) / 2,
            boardW: cell * TUNING.board.cols,
            boardH: cell * TUNING.board.rows,
            cell,
            padCenterY,
            hintCenterY,
            contentWidth,
        };
    }
}
