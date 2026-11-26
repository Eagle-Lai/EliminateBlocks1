/**
 * 棋盘手势：拖动按格移动、轻点旋转；带 UI 坐标 → 棋盘本地坐标换算。
 * 只发意图，不改模型。
 */
import { EventTouch, Node, UITransform, Vec3, isValid } from 'cc';
import type { BoardView } from '../view/BoardView';
import { TUNING } from '../config/GameTuning';

export interface BoardInputHandlers {
    canInput: () => boolean;
    onMove: (dx: number, dy: number) => boolean;
    gravityDir: () => 1 | -1;
    onRotate: () => void;
    onTapCell: (r: number, c: number) => void;
}

export class BoardInput {
    private _drag: { startX: number; startY: number; sx: number; sy: number; moved: boolean; at: number } | null = null;

    constructor(
        private readonly host: Node,
        private readonly board: BoardView,
        private readonly handlers: BoardInputHandlers,
    ) {
        this.host.on(Node.EventType.TOUCH_START, this._start, this);
        this.host.on(Node.EventType.TOUCH_MOVE, this._move, this);
        this.host.on(Node.EventType.TOUCH_END, this._end, this);
        this.host.on(Node.EventType.TOUCH_CANCEL, this.cancel, this);
    }

    private _local(e: EventTouch): Vec3 {
        const ui = e.getUILocation();
        const transform = this.host.getComponent(UITransform);
        if (!transform) return new Vec3(ui.x, ui.y, 0);
        return transform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
    }

    private _start(e: EventTouch): void {
        if (!this.handlers.canInput()) return;
        const local = this._local(e);
        this._drag = { startX: local.x, startY: local.y, sx: 0, sy: 0, moved: false, at: Date.now() };
    }

    private _move(e: EventTouch): void {
        const drag = this._drag;
        if (!drag || !this.handlers.canInput()) return;
        const local = this._local(e);
        const cell = this.board.cell;
        const tx = Math.round((local.x - drag.startX) / cell);
        const ty = Math.round((drag.startY - local.y) / cell);
        while (drag.sx < tx) {
            if (this.handlers.onMove(1, 0)) drag.moved = true;
            drag.sx++;
        }
        while (drag.sx > tx) {
            if (this.handlers.onMove(-1, 0)) drag.moved = true;
            drag.sx--;
        }
        const dir = this.handlers.gravityDir();
        while (drag.sy * dir < ty * dir) {
            if (this.handlers.onMove(0, dir)) drag.moved = true;
            drag.sy += dir;
        }
    }

    private _end(e: EventTouch): void {
        const drag = this._drag;
        this._drag = null;
        if (!drag || !this.handlers.canInput()) return;
        const local = this._local(e);
        const cell = this.board.cell;
        const moved =
            drag.moved ||
            Math.abs(local.x - drag.startX) > cell * TUNING.input.tapMaxCellRatio ||
            Math.abs(local.y - drag.startY) > cell * TUNING.input.tapMaxCellRatio;
        const quick = Date.now() - drag.at < TUNING.input.tapMaxMs;
        if (!moved && quick) {
            this.handlers.onRotate();
        } else if (!moved) {
            const cellPos = this.board.localToCell(local);
            this.handlers.onTapCell(cellPos.r, cellPos.c);
        }
    }

    cancel(): void {
        this._drag = null;
    }

    destroy(): void {
        // 销毁对局时棋盘子节点先于控制器释放，事件也已随节点移除。
        if (!isValid(this.host, true)) return;
        this.host.off(Node.EventType.TOUCH_START, this._start, this);
        this.host.off(Node.EventType.TOUCH_MOVE, this._move, this);
        this.host.off(Node.EventType.TOUCH_END, this._end, this);
        this.host.off(Node.EventType.TOUCH_CANCEL, this.cancel, this);
    }
}
