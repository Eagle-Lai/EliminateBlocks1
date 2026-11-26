/** 可注入种子的确定性随机（mulberry32），便于回放与每日挑战。 */
export class Rng {
    private _state: number;

    constructor(seed?: number) {
        this._state = (seed === undefined ? Date.now() : seed) >>> 0;
        if (this._state === 0) this._state = 0x9e3779b9;
    }

    getState(): number { return this._state; }

    setState(state: number): void { this._state = state >>> 0; }

    next(): number {
        this._state = (this._state + 0x6d2b79f5) >>> 0;
        let t = this._state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** [0, max) 的整数 */
    int(max: number): number {
        return Math.floor(this.next() * max) % max;
    }

    pick<T>(arr: readonly T[]): T {
        return arr[this.int(arr.length)];
    }
}
