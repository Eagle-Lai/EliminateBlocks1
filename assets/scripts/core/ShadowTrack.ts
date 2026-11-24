/**
 * 影子：每 5s 采样自己的最佳局分数曲线（≤120 点）。
 * 当前分数第一次超过影子时触发一次金色脉冲（overtake），之后不再触发。
 */
export interface ShadowSample {
    t: number;
    score: number;
}

export interface ShadowState {
    bestScore: number;
    samples: ShadowSample[];
    seed: number;
    recordId: string;
}

export class ShadowTrack {
    private _samples: ShadowSample[] = [];
    private _overtaken = false;
    private _lastSampleAt = -1;

    constructor(
        private readonly sampleMs: number,
        private readonly maxSamples: number,
    ) {}

    get samples(): readonly ShadowSample[] {
        return this._samples;
    }

    get overtaken(): boolean {
        return this._overtaken;
    }

    load(state: ShadowState | null): void {
        this._samples = state ? state.samples.slice(0, this.maxSamples) : [];
        this._overtaken = false;
        this._lastSampleAt = -1;
    }

    /** 影子在 t 时刻的分数（线性插值；超出末点取末点） */
    at(t: number): number {
        if (this._samples.length === 0) return 0;
        if (t <= this._samples[0].t) return this._samples[0].score;
        for (let i = 1; i < this._samples.length; i++) {
            const prev = this._samples[i - 1];
            const cur = this._samples[i];
            if (t <= cur.t) {
                if (cur.t === prev.t) return cur.score;
                const k = (t - prev.t) / (cur.t - prev.t);
                return prev.score + (cur.score - prev.score) * k;
            }
        }
        return this._samples[this._samples.length - 1].score;
    }

    /** 对局内累计时间（毫秒）与当前分数；返回是否刚反超 */
    feed(elapsedMs: number, score: number): boolean {
        if (!this._overtaken && this._samples.length > 0 && score > this.at(elapsedMs)) {
            this._overtaken = true;
            return true;
        }
        return false;
    }

    /** 每 5s 采样一次（对局内累计时间） */
    sample(elapsedMs: number, score: number): void {
        if (this._lastSampleAt >= 0 && elapsedMs - this._lastSampleAt < this.sampleMs) return;
        this._lastSampleAt = elapsedMs;
        this._samples.push({ t: elapsedMs, score });
        while (this._samples.length > this.maxSamples) this._samples.shift();
    }

    reset(): void {
        this._samples = [];
        this._overtaken = false;
        this._lastSampleAt = -1;
    }

    toState(bestScore: number, seed: number, recordId: string): ShadowState {
        return { bestScore, samples: this._samples.slice(), seed, recordId };
    }
}
