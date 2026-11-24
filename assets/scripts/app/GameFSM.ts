/** 状态机：集中管理合法迁移，非法迁移只记录不崩溃。 */
import { Logger } from '../utils/Logger';

export type GameState =
    | 'ready'
    | 'home'
    | 'playing'
    | 'resolving'
    | 'paused'
    | 'over'
    | 'mutationIntro'
    | 'talentPick'
    | 'itemSelect'
    | 'replay';

const ALLOWED: Record<GameState, GameState[]> = {
    ready: ['home', 'playing', 'mutationIntro'],
    home: ['playing', 'mutationIntro', 'replay', 'ready'],
    playing: ['resolving', 'paused', 'over', 'talentPick', 'itemSelect', 'home'],
    resolving: ['playing', 'over', 'paused', 'talentPick', 'itemSelect', 'home'],
    paused: ['playing', 'over', 'home'],
    over: ['ready', 'playing', 'home'],
    mutationIntro: ['playing', 'home', 'over'],
    talentPick: ['playing', 'over', 'home'],
    itemSelect: ['playing', 'over', 'paused', 'home'],
    replay: ['home', 'ready'],
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

    /** 红线：只包含 resolving（lock 结尾依赖这个语义） */
    isBusy(): boolean {
        return this._state === 'resolving';
    }

    /** 覆盖层：禁止重开/暂停，但不等同 busy */
    isOverlay(): boolean {
        const s = this._state;
        return s === 'talentPick' || s === 'itemSelect' || s === 'mutationIntro' || s === 'replay' || s === 'home';
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
