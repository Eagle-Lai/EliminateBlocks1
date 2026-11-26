/** 回放与每日记录存档：最近 10 局 FIFO，单条 ≤30KB。 */
import { storage, StorageKey } from './StorageService';
import { trimReplay, replayBytes, isReplayData, type ReplayData } from '../core/InputRecorder';
import { TUNING } from '../config/GameTuning';
import { Logger } from '../utils/Logger';
import { dateKey, dayOfYearFromDate, monthDayFromDayOfYear } from '../core/DailyPuzzle';

export interface ReplayIndexEntry {
    id: string;
    score: number;
    at: number;
    mode: string;
}

interface YearProgress {
    bestMoves: Record<number, number>;
    done: number[];
}

interface DailySave {
    lastDoneDate: string;
    streak: number;
    lastHintDate: string;
    years: Record<string, YearProgress>;
}

function readYear(raw?: Partial<YearProgress>): YearProgress {
    const done = Array.isArray(raw?.done)
        ? raw!.done.filter(day => Number.isInteger(day) && day >= 1 && day <= 365) : [];
    const bestMoves: Record<number, number> = {};
    for (const day of done) {
        const moves = raw?.bestMoves?.[day];
        if (typeof moves === 'number' && Number.isInteger(moves) && moves > 0) bestMoves[day] = moves;
    }
    return { done: Array.from(new Set(done)), bestMoves };
}

function yesterday(date: Date): string {
    return dateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

class ReplayStoreImpl {
    save(record: ReplayData): void {
        const data = trimReplay(record, TUNING.replay.maxBytes);
        if (replayBytes(data) > TUNING.replay.maxBytes) {
            Logger.warn('Replay', '回放超限，已丢弃');
            return;
        }
        const index = this.list().filter(entry => entry.id !== data.id);
        index.unshift({ id: data.id, score: data.score, at: data.createdAt, mode: data.mode });
        while (index.length > TUNING.replay.maxRecords) {
            const dropped = index.pop();
            if (dropped) storage.remove(`${StorageKey.ReplayPrefix}${dropped.id}`);
        }
        storage.setJson(`${StorageKey.ReplayPrefix}${data.id}`, data);
        storage.setJson(StorageKey.ReplayIndex, index);
    }

    list(): ReplayIndexEntry[] {
        const entries = storage.getJson<ReplayIndexEntry[]>(StorageKey.ReplayIndex, []);
        return Array.isArray(entries) ? entries.filter(entry => entry && typeof entry.id === 'string' && Number.isFinite(entry.score)) : [];
    }

    get(id: string): ReplayData | null {
        const record = storage.getJson<ReplayData | null>(`${StorageKey.ReplayPrefix}${id}`, null);
        return isReplayData(record) && record.id === id ? record : null;
    }

    latest(): ReplayData | null {
        for (const entry of this.list()) {
            const record = this.get(entry.id);
            if (record) return record;
        }
        return null;
    }

    best(): ReplayData | null {
        for (const entry of this.list().sort((a, b) => b.score - a.score || b.at - a.at)) {
            const record = this.get(entry.id);
            if (record) return record;
        }
        return null;
    }

    private _daily(date: Date): DailySave {
        const raw = storage.getJson<Partial<DailySave & YearProgress> | null>(StorageKey.Daily, null);
        const data: DailySave = {
            years: raw?.years && typeof raw.years === 'object' ? raw.years : {},
            lastDoneDate: typeof raw?.lastDoneDate === 'string' ? raw.lastDoneDate : '',
            lastHintDate: typeof raw?.lastHintDate === 'string' ? raw.lastHintDate : '',
            streak: Number.isInteger(raw?.streak) ? Math.max(0, raw!.streak!) : 0,
        };
        if (raw && !raw.years) {
            // Legacy records contained puzzle numbers, but no year or individual play dates.
            const progress = readYear(raw);
            const last = Number(raw.lastDoneDate);
            const year = date.getFullYear() - (last > dayOfYearFromDate(date) ? 1 : 0);
            data.years[year] = progress;
            data.streak = 0;
            data.lastDoneDate = '';
            if (progress.done.indexOf(last) >= 0) {
                const { month, day } = monthDayFromDayOfYear(last);
                data.lastDoneDate = dateKey(new Date(year, month - 1, day));
                for (let d = last; progress.done.indexOf(d) >= 0; d--) data.streak++;
            }
            storage.setJson(StorageKey.Daily, data);
        }
        return data;
    }

    markDailyDone(day: number, moves: number, date = new Date(), puzzleYear = date.getFullYear()): void {
        const data = this._daily(date);
        const progress = readYear(data.years[puzzleYear]);
        if (progress.done.indexOf(day) < 0) progress.done.push(day);
        progress.bestMoves[day] = Math.min(progress.bestMoves[day] ?? moves, moves);
        data.years[puzzleYear] = progress;
        const today = dateKey(date);
        if (puzzleYear === date.getFullYear() && day === dayOfYearFromDate(date) && today > data.lastDoneDate) {
            data.streak = data.lastDoneDate === yesterday(date) ? data.streak + 1 : 1;
            data.lastDoneDate = today;
        }
        storage.setJson(StorageKey.Daily, data);
    }

    dailyDone(date = new Date()): number[] {
        return readYear(this._daily(date).years[date.getFullYear()]).done;
    }

    streak(date = new Date()): number {
        const data = this._daily(date);
        return data.lastDoneDate >= yesterday(date) ? data.streak : 0;
    }

    bestMoves(day: number, date = new Date()): number {
        return readYear(this._daily(date).years[date.getFullYear()]).bestMoves[day] ?? 0;
    }

    canUseHint(date = new Date()): boolean {
        return this._daily(date).lastHintDate < dateKey(date);
    }

    markHintUsed(date = new Date()): void {
        const data = this._daily(date);
        data.lastHintDate = dateKey(date);
        storage.setJson(StorageKey.Daily, data);
    }
}

export const replayStore = new ReplayStoreImpl();
