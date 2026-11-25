/** 回放控制器：逐锁重演（同种子 + 同动作 → 与对局一致的分数与棋盘）。 */
import { BoardModel } from '../core/BoardModel';
import type { ReplayData } from '../core/InputRecorder';
import type { ReplayView } from '../view/ReplayView';
import { ReplayPlayer } from '../core/ReplayPlayer';
import { rotationCells } from '../core/PieceSource';
import { simulateLock } from '../core/Simulator';
import { TUNING } from '../config/GameTuning';
import { Logger } from '../utils/Logger';
import { nav } from '../app/Navigator';
import type { SpriteFrame } from 'cc';

export class ReplayController {
    private _board: BoardModel;
    private _index = 0;
    private _score = 0;
    private _playing = false;
    private _timer = 0;
    private _speed = 1;
    private _data: ReplayData;

    constructor(
        private readonly view: ReplayView,
        data: ReplayData,
        private readonly frames: (SpriteFrame | null)[],
    ) {
        this._data = data;
        this._board = data.initialBoard.length > 0
            ? BoardModel.fromPattern(data.initialBoard)
            : new BoardModel(TUNING.board.cols, TUNING.board.rows);
    }

    async start(): Promise<void> {
        this.view.onOpen();
        this.view.bind({
            onPlayPause: () => this.toggle(),
            onSpeed: () => this.cycleSpeed(),
            onSeek: (ratio) => this.seek(ratio),
            onClose: () => this.close(),
        });
        this.view.setSpeed(this._speed);
        this.view.setPlaying(false);
        this.view.board?.init(this.frames);
        this.view.board?.layout(TUNING.board.cols, TUNING.board.rows, 54);
        await this._render(0);
    }

    private _locks(): number {
        return this._data.actions.filter((a) => a.t === 'lock').length;
    }

    private async _render(actionIndex: number): Promise<void> {
        this._index = Math.max(0, Math.min(this._data.actions.length, actionIndex));
        // 从头重演到目标索引（动作数有限，重放成本可忽略；seek 因此天然正确）
        this._board = this._data.initialBoard.length > 0
            ? BoardModel.fromPattern(this._data.initialBoard)
            : new BoardModel(TUNING.board.cols, TUNING.board.rows);
        this._score = 0;
        let locks = 0;
        for (let i = 0; i < this._index; i++) {
            const action = this._data.actions[i];
            if (action.t !== 'lock') continue;
            locks++;
            const cells = rotationCells(action.shape, action.rotation);
            const result = simulateLock(this._board, cells, action.x, action.y, action.color, locks);
            this._score += result.gain;
        }
        await this.view.board?.rebuild(this._board, 0);
        this.view.setScore(this._score);
        this.view.setTime(`${locks} 锁 · ${this._index}/${this._data.actions.length} 步`);
    }

    private toggle(): void {
        this._playing = !this._playing;
        this.view.setPlaying(this._playing);
    }

    private cycleSpeed(): void {
        this._speed = this._speed === 1 ? 2 : 1;
        this.view.setSpeed(this._speed);
    }

    private seek(ratio: number): void {
        void this._render(Math.round(ratio * this._data.actions.length));
    }

    update(dt: number): void {
        if (!this._playing) return;
        this._timer += dt * this._speed;
        if (this._timer < 0.55) return;
        this._timer = 0;
        if (this._index >= this._data.actions.length) {
            this._playing = false;
            this.view.setPlaying(false);
            const check = ReplayPlayer.simulate(this._data).score === this._score;
            Logger.info('Replay', `重演完成：${this._score} 分（确定性校验 ${check ? '通过' : '失败'}）`);
            this.view.setTime(`完成 · ${check ? '确定性校验通过' : '校验失败'}`);
            return;
        }
        void this._render(this._index + 1);
    }

    /** 关闭回放：回放是 panel 层（互斥已关闭主界面），必须显式回主界面，避免黑屏。 */
    close(): void {
        nav.toHome();
    }

    /** 确定性校验（验收用） */
    static verify(data: ReplayData): boolean {
        return ReplayPlayer.verify(data);
    }
}
