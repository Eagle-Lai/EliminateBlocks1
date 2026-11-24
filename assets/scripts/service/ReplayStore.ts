/** 回放与每日记录存档：最近 10 局 FIFO，单条 ≤30KB。 */
import { storage, StorageKey } from './StorageService';
import { trimReplay, replayBytes, type ReplayData } from '../core/InputRecorder';
import { TUNING } from '../config/GameTuning';
import { Logger } from '../utils/Logger';

export interface ReplayIndexEntry {
    id: string;
    score: number;
    at: number;
    mode: string;
}

interface DailySave {
    lastDoneDate: string;
    streak: number;
    bestMoves: Record<number, number>;
    done: number[];
}

class ReplayStoreImpl {
    save(record: ReplayData): void {
        const data = trimReplay(record, TUNING.replay.maxBytes);
        if (replayBytes(data) > TUNING.replay.maxBytes) {
            Logger.warn('Replay', '回放超限，已丢弃');
            return;
        }
        const index = this.list();
        index.unshift({ id: data.id, score: data.score, at: data.createdAt, mode: data.mode });
        while (index.length > TUNING.replay.maxRecords) {
            const dropped = index.pop();
            if (dropped) storage.remove(`${StorageKey.ReplayPrefix}${dropped.id}`);
        }
        storage.setJson(StorageKey.ReplayIndex, index);
        storage.setJson(`${StorageKey.ReplayPrefix}${data.id}`, data);
    }

    list(): ReplayIndexEntry[] {
        return storage.getJson<ReplayIndexEntry[]>(StorageKey.ReplayIndex, []);
    }

    get(id: string): ReplayData | null {
        return storage.getJson<ReplayData | null>(`${StorageKey.ReplayPrefix}${id}`, null);
    }

    latest(): ReplayData | null {
        const list = this.list();
        return list.length > 0 ? this.get(list[0].id) : null;
    }

    private _daily(): DailySave {
        return storage.getJson<DailySave>(StorageKey.Daily, {
            lastDoneDate: '',
            streak: 0,
            bestMoves: {},
            done: [],
        });
    }

    markDailyDone(day: number, moves: number): void {
        const data = this._daily();
        if (data.done.indexOf(day) < 0) data.done.push(day);
        const prev = data.bestMoves[day] ?? Number.MAX_SAFE_INTEGER;
        data.bestMoves[day] = Math.min(prev, moves);
        data.lastDoneDate = `${day}`;
        data.streak += 1;
        storage.setJson(StorageKey.Daily, data);
    }

    dailyDone(): number[] {
        return this._daily().done;
    }

    streak(): number {
        return this._daily().streak;
    }

    bestMoves(day: number): number {
        return this._daily().bestMoves[day] ?? 0;
    }
}

export const replayStore = new ReplayStoreImpl();
