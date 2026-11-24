/** 状态机：集中管理合法迁移，非法迁移只记录不崩溃。 */
import { Logger } from '../utils/Logger';

export type GameState = 'ready' | 'playing' | 'resolving' | 'paused' | 'over';

const ALLOWED: Record<GameState, GameState[]> = {
    ready: ['playing'],
    playing: ['resolving', 'paused', 'over'],
    resolving: ['playing', 'over', 'paused'],
    paused: ['playing', 'over'],
    over: ['ready', 'playing'],
};

export class GameFSM {
    private _state: GameState = 'ready';

    get state(): GameState {
        return this._state;
    }

    canAcceptInput(): boolean {
        return this._state === 'playing';
    }

    get isOver(): boolean {
        return this._state === 'over';
    }

    isBusy(): boolean {
        return this._state === 'resolving';
    }

    transition(to: GameState): boolean {
        if (this._state === to) return true;
        if (ALLOWED[this._state].indexOf(to) < 0) {
            Logger.warn('FSM', `非法迁移：${this._state} -> ${to}`);
            return false;
        }
        this._state = to;
        return true;
    }

    /** 重开等强制场景 */
    force(to: GameState): void {
        this._state = to;
    }
}
