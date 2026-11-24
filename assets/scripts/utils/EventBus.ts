/** 轻量类型化事件总线：View 层只订阅，Controller 负责派发。 */
type Handler = (...args: any[]) => void;

interface Entry {
    fn: Handler;
    ctx: unknown;
}

export class EventBus {
    private _map = new Map<string, Entry[]>();

    on(event: string, fn: Handler, ctx?: unknown): void {
        const list = this._map.get(event) || [];
        list.push({ fn, ctx });
        this._map.set(event, list);
    }

    off(event: string, fn: Handler): void {
        const list = this._map.get(event);
        if (!list) return;
        const idx = list.findIndex((e) => e.fn === fn);
        if (idx >= 0) list.splice(idx, 1);
    }

    emit(event: string, ...args: any[]): void {
        const list = this._map.get(event);
        if (!list) return;
        for (const entry of list.slice()) {
            entry.fn.apply(entry.ctx, args);
        }
    }

    clear(): void {
        this._map.clear();
    }
}

export const bus = new EventBus();

export const GameEvent = {
    PieceSpawn: 'piece:spawn',
    PieceMove: 'piece:move',
    PieceLock: 'piece:lock',
    BoardPop: 'board:pop',
    ScoreChange: 'score:change',
    LevelChange: 'level:change',
    Banner: 'ui:banner',
    GameOver: 'game:over',
    GameStart: 'game:start',
} as const;
