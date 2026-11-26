/**
 * 音频服务：SFX + BGM（淡入淡出 / duck / 总线音量）。
 * 资源缺失时静默降级（仅兜底）；构建期由 verify:assets 拦截缺文件。
 */
import { AudioClip, AudioSource, Game, Node, game, tween } from 'cc';
import { assets } from './AssetService';
import { BGM_PATHS, SFX_PATHS, USE_BUNDLES, type BgmKey, type SfxKey } from '../config/AssetKeys';
import { Logger } from '../utils/Logger';

class AudioServiceImpl {
    private _sfx: AudioSource | null = null;
    private _bgm: AudioSource | null = null;
    private _muted = false;
    private _unlocked = false;
    private _sfxVolume = 0.8;
    private _bgmVolume = 0.6;
    private _current: BgmKey | null = null;
    private _ducked = false;
    private _fadeToken = 0;
    private _trackRequest = 0;
    private _gain = 1;
    private _hidden = false;
    private _clips = new Map<SfxKey, AudioClip>();

    init(root: Node): void {
        const sfxNode = new Node('SfxHost');
        sfxNode.setParent(root);
        const a = sfxNode.addComponent(AudioSource);
        a.volume = this._sfxVolume;
        a.playOnAwake = false;
        this._sfx = a;

        const bgmNode = new Node('BgmHost');
        bgmNode.setParent(root);
        const b = bgmNode.addComponent(AudioSource);
        b.volume = 0;
        b.playOnAwake = false;
        b.loop = true;
        this._bgm = b;

        game.off(Game.EVENT_HIDE, this.pauseBgm, this);
        game.off(Game.EVENT_SHOW, this.resumeBgm, this);
        game.on(Game.EVENT_HIDE, this.pauseBgm, this);
        game.on(Game.EVENT_SHOW, this.resumeBgm, this);
    }

    async preload(onLoaded?: () => void): Promise<void> {
        const keys = Object.keys(SFX_PATHS) as SfxKey[];
        if (USE_BUNDLES) {
            await assets.loadBundle('audio-sfx');
            for (const key of keys) {
                const clip = await assets.loadClipFromBundle('audio-sfx', SFX_PATHS[key]);
                if (clip) this._clips.set(key, clip);
                onLoaded?.();
            }
            return;
        }
        await assets.preloadClips(keys.map((k) => SFX_PATHS[k]), onLoaded);
    }

    setMuted(muted: boolean): void {
        this._muted = muted;
        this._applyVolume();
    }

    get muted(): boolean {
        return this._muted;
    }

    setBusVolume(bus: 'bgm' | 'sfx', value: number): void {
        if (bus === 'bgm') {
            this._bgmVolume = Math.max(0, Math.min(1, value));
            this._applyVolume();
        } else {
            this._sfxVolume = Math.max(0, Math.min(1, value));
            if (this._sfx) this._sfx.volume = this._sfxVolume;
        }
    }

    unlock(): void {
        this._unlocked = true;
    }

    play(key: SfxKey, volumeScale = 1): void {
        if (this._muted || !this._unlocked || !this._sfx) return;
        const clip: AudioClip | null = this._clips.get(key) ?? assets.getClip(SFX_PATHS[key]);
        if (!clip) return;
        try {
            this._sfx.playOneShot(clip, volumeScale);
        } catch (err) {
            Logger.warn('AudioService', '播放失败', err);
        }
    }

    /** 播放 BGM（从 Bundle 取；同曲不重播） */
    async playBgm(key: BgmKey, fadeMs = 400): Promise<void> {
        const request = ++this._trackRequest;
        if (this._current === key && this._bgm?.playing) return;
        const cfg = BGM_PATHS[key];
        const clip = USE_BUNDLES
            ? await assets.loadClipFromBundle(cfg.bundle, cfg.path)
            : await assets.loadClip(`audio/bgm/${cfg.path}`);
        if (request !== this._trackRequest) return;
        if (!clip || !this._bgm) {
            Logger.warn('AudioService', `BGM 不可用：${key}`);
            return;
        }
        this._current = key;
        this._bgm.stop();
        this._bgm.clip = clip;
        this._bgm.loop = true;
        this._bgm.volume = 0;
        this._gain = 0;
        if (!this._hidden) this._bgm.play();
        this._fadeTo(this._ducked ? 0.6 : 1, fadeMs);
    }

    stopBgm(fadeMs = 300): void {
        ++this._trackRequest;
        this._current = null;
        if (!this._bgm) return;
        this._fadeTo(0, fadeMs, () => this._bgm?.stop());
    }

    pauseBgm(): void {
        this._hidden = true;
        if (this._bgm) this._bgm.pause();
    }

    resumeBgm(): void {
        this._hidden = false;
        if (this._bgm && this._current && !this._bgm.playing) this._bgm.play();
    }

    /** 弹窗打开时压低 BGM */
    duck(ms = 300): void {
        if (!this._bgm) return;
        this._ducked = true;
        if (this._current) this._fadeTo(0.6, ms);
    }

    unduck(ms = 250): void {
        this._ducked = false;
        if (this._current) this._fadeTo(1, ms);
    }

    private _applyVolume(): void {
        if (this._bgm) this._bgm.volume = this._muted ? 0 : this._gain * this._bgmVolume;
    }

    private _fadeTo(target: number, ms: number, done?: () => void): void {
        if (!this._bgm) return;
        this._fadeToken++;
        const token = this._fadeToken;
        const from = this._gain;
        const proxy = { v: from };
        tween(proxy)
            .to(Math.max(0.05, ms / 1000), { v: target }, {
                onUpdate: () => {
                    if (token !== this._fadeToken || !this._bgm) return;
                    this._gain = proxy.v;
                    this._applyVolume();
                },
            })
            .call(() => {
                if (token !== this._fadeToken) return;
                done?.();
            })
            .start();
    }
}

export const audio = new AudioServiceImpl();
