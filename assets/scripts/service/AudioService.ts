/**
 * 音频服务：BGM + 一次性音效。
 * 资源缺失时静默降级（不阻塞游戏），首次触摸后解锁 iOS 音频。
 */
import { AudioClip, AudioSource, Game, Node, game } from 'cc';
import { assets } from './AssetService';
import { Logger } from '../utils/Logger';

const SFX_PATHS = {
    move: 'audio/sfx/move',
    rotate: 'audio/sfx/rotate',
    lock: 'audio/sfx/lock',
    popLow: 'audio/sfx/pop_low',
    popMid: 'audio/sfx/pop_mid',
    popHigh: 'audio/sfx/pop_high',
    row: 'audio/sfx/row',
    levelUp: 'audio/sfx/levelup',
    over: 'audio/sfx/over',
    start: 'audio/sfx/start',
} as const;

export type SfxKey = keyof typeof SFX_PATHS;

class AudioServiceImpl {
    private _source: AudioSource | null = null;
    private _muted = false;
    private _unlocked = false;
    private _volume = 0.8;

    init(root: Node): void {
        const node = new Node('AudioHost');
        node.setParent(root);
        const src = node.addComponent(AudioSource);
        src.volume = this._volume;
        src.playOnAwake = false;
        this._source = src;

        game.on(Game.EVENT_HIDE, () => this._source?.pause());
        game.on(Game.EVENT_SHOW, () => {
            /* BGM 恢复由外部控制，避免打断用户意图 */
        });
    }

    async preload(): Promise<void> {
        const paths: string[] = [];
        for (const key of Object.keys(SFX_PATHS)) {
            paths.push(SFX_PATHS[key as SfxKey]);
        }
        await assets.preloadClips(paths);
    }

    setMuted(muted: boolean): void {
        this._muted = muted;
    }

    get muted(): boolean {
        return this._muted;
    }

    unlock(): void {
        this._unlocked = true;
    }

    play(key: SfxKey, volumeScale = 1): void {
        if (this._muted || !this._unlocked || !this._source) return;
        const clip: AudioClip | null = assets.getClip(SFX_PATHS[key]);
        if (!clip) return;
        try {
            this._source.playOneShot(clip, volumeScale);
        } catch (err) {
            Logger.warn('AudioService', '播放失败', err);
        }
    }
}

export const audio = new AudioServiceImpl();
