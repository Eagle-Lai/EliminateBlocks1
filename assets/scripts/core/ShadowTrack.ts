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
    private _reference: ShadowSample[] = [];
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
        this._samples = [];
        this._reference = [];
        if (Array.isArray(state?.samples)) {
            const points = state.samples.filter(p => p && Number.isFinite(p.t) && p.t >= 0
                && Number.isSafeInteger(p.score) && p.score >= 0 && p.score <= state.bestScore);
            points.sort((a, b) => a.t - b.t);
            for (const point of points) {
                if (this._reference.length >= this.maxSamples) break;
                const previous = this._reference[this._reference.length - 1];
                if (!previous || point.t > previous.t) this._reference.push({ t: point.t, score: point.score });
            }
        }
        this._overtaken = false;
        this._lastSampleAt = -1;
    }

    /** 影子在 t 时刻的分数（线性插值；超出末点取末点） */
    at(t: number): number {
        if (this._reference.length === 0) return 0;
        if (t <= this._reference[0].t) return this._reference[0].score;
        for (let i = 1; i < this._reference.length; i++) {
            const prev = this._reference[i - 1];
            const cur = this._reference[i];
            if (t <= cur.t) {
                if (cur.t === prev.t) return cur.score;
                const k = (t - prev.t) / (cur.t - prev.t);
                return prev.score + (cur.score - prev.score) * k;
            }
        }
        return this._reference[this._reference.length - 1].score;
    }

    /** 对局内累计时间（毫秒）与当前分数；返回是否刚反超 */
    feed(elapsedMs: number, score: number): boolean {
        if (!this._overtaken && this._reference.length > 0 && score > this.at(elapsedMs)) {
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
        if (this._samples.length > this.maxSamples) {
            // 保留起点和新采样；删除相邻点可线性近似的旧采样。
            let remove = 0;
            let bestError = Infinity;
            for (let i = 1; i < this._samples.length - 1; i++) {
                const prev = this._samples[i - 1];
                const cur = this._samples[i];
                const next = this._samples[i + 1];
                const k = (cur.t - prev.t) / (next.t - prev.t);
                const error = Math.abs(cur.score - (prev.score + k * (next.score - prev.score)));
                if (error < bestError) { bestError = error; remove = i; }
            }
            this._samples.splice(remove, 1);
        }
    }

    reset(): void {
        this._reference = [];
        this._samples = [];
        this._overtaken = false;
        this._lastSampleAt = -1;
    }

    toState(bestScore: number, seed: number, recordId: string): ShadowState {
        return { bestScore, samples: this._samples.slice(), seed, recordId };
    }
}
