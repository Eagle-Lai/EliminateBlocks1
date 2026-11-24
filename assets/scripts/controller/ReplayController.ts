/** 回放控制器：按快照时间轴驱动 ReplayView（不做逐帧重演，避免与手感耦合）。 */
import { BoardModel } from '../core/BoardModel';
import type { ReplayData } from '../core/InputRecorder';
import type { ReplayView } from '../view/ReplayView';
import { ReplayPlayer } from '../core/ReplayPlayer';
import { assets } from '../service/AssetService';
import { ART } from '../config/AssetKeys';

export class ReplayController {
    private _index = 0;
    private _playing = false;
    private _speed = 1;
    private _timer = 0;
    private _data: ReplayData;
    private _onUpdate: (() => void) | null = null;

    constructor(private readonly view: ReplayView, data: ReplayData) {
        this._data = data;
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
        await this._render(0);
        const sf = await assets.loadSpriteFrame(ART.bg.home);
        void sf;
    }

    get data(): ReplayData {
        return this._data;
    }

    private async _render(index: number): Promise<void> {
        const snaps = this._data.snapshots;
        if (snaps.length === 0) {
            this.view.setScore(this._data.score);
            this.view.setTime('0:00');
            return;
        }
        this._index = Math.max(0, Math.min(snaps.length - 1, index));
        const snap = snaps[this._index];
        const board = BoardModel.fromPattern(snap.board.split('\n'));
        await this.view.board?.rebuild(board, 0);
        this.view.setScore(snap.score);
        this.view.setTime(`${snap.lock} 锁 · ${this._index + 1}/${snaps.length}`);
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
        const snaps = this._data.snapshots;
        if (snaps.length === 0) return;
        void this._render(Math.round(ratio * (snaps.length - 1)));
    }

    update(dt: number): void {
        if (!this._playing) return;
        this._timer += dt * this._speed;
        if (this._timer < 0.6) return;
        this._timer = 0;
        const snaps = this._data.snapshots;
        if (this._index + 1 >= snaps.length) {
            this._playing = false;
            this.view.setPlaying(false);
            return;
        }
        void this._render(this._index + 1);
    }

    close(): void {
        this.view.close();
    }

    /** 确定性校验（验收用） */
    static verify(data: ReplayData): boolean {
        const sim = ReplayPlayer.simulate(data);
        return sim.mismatchAt === null;
    }
}
