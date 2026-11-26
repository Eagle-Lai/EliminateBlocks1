/** 回放控制器：逐锁重演（同种子 + 同动作 → 与对局一致的分数与棋盘）。 */
import type { ReplayData } from '../core/InputRecorder';
import type { ReplayView } from '../view/ReplayView';
import { ReplayPlayer } from '../core/ReplayPlayer';
import { TUNING } from '../config/GameTuning';
import { Logger } from '../utils/Logger';
import { nav } from '../app/Navigator';
import type { SpriteFrame } from 'cc';

export class ReplayController {
    private _closed = false;
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
    }

    async start(): Promise<void> {
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

    private async _render(actionIndex: number): Promise<void> {
        const index = this._index = Math.max(0, Math.min(this._data.actions.length, actionIndex));
        const state = ReplayPlayer.renderAt(this._data, index);
        await this.view.board?.rebuild(state.board, 0);
        if (this._closed || this._index !== index) return;
        this._score = state.score;
        this.view.setScore(this._score);
        this.view.setProgress(index / Math.max(1, this._data.actions.length));
        const prefix = this._data.partial ? '近期片段 · ' : '';
        this.view.setTime(prefix + state.locks + ' 锁 · ' + index + '/' + this._data.actions.length + ' 步');
    }

    private toggle(): void {
        if (!this._playing && this._index >= this._data.actions.length) void this._render(0);
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
            const check = ReplayPlayer.verify(this._data);
            Logger.info('Replay', `回放完成：${this._score} 分（${check ? '记录一致' : '记录未能校验'}）`);
            this.view.setTime(`完成 · ${check ? '记录一致' : '记录未能校验'}`);
            return;
        }
        void this._render(this._index + 1);
    }

    /** 关闭回放：回放是 panel 层（互斥已关闭主界面），必须显式回主界面，避免黑屏。 */
    close(): void {
        this._closed = true;
        this._playing = false;
        nav.toHome();
    }

    /** 确定性校验（验收用） */
    static verify(data: ReplayData): boolean {
        return ReplayPlayer.verify(data);
    }
}
