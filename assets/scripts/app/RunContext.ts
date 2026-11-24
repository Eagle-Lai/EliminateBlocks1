/** 单局上下文：runId + 取消令牌 + 随机源 + 本局统计。重开时整体替换。 */
import { CancelToken } from '../utils/CancelToken';
import { Rng } from '../utils/Rng';

export class RunContext {
    readonly token = new CancelToken();
    readonly rng: Rng;
    rowsCleared = 0;
    maxChain = 0;
    pieces = 0;

    constructor(
        readonly runId: number,
        seed: number,
    ) {
        this.rng = new Rng(seed);
    }

    cancel(): void {
        this.token.cancel();
    }

    get cancelled(): boolean {
        return this.token.cancelled;
    }
}
