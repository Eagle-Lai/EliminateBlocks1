/** 协程取消令牌：重开 / 切场景时杀死所有未完成的异步段。 */
export class CancelError extends Error {
    constructor(message = 'cancelled') {
        super(message);
        this.name = 'CancelError';
    }
}

export class CancelToken {
    private _cancelled = false;

    get cancelled(): boolean {
        return this._cancelled;
    }

    cancel(): void {
        this._cancelled = true;
    }

    throwIfCancelled(): void {
        if (this._cancelled) throw new CancelError();
    }
}
