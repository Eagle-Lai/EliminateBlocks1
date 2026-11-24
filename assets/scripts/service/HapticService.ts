/** 触感反馈：能力探测 + 失败静默，非微信环境直接 no-op。 */
import { TUNING } from '../config/GameTuning';

class HapticServiceImpl {
    private _enabled = true;

    private get _wx(): any {
        return (globalThis as any).wx ?? null;
    }

    setEnabled(value: boolean): void {
        this._enabled = value;
    }

    light(): void {
        if (!this._enabled) return;
        const wx = this._wx;
        if (!wx || typeof wx.vibrateShort !== 'function') return;
        try {
            wx.vibrateShort({ type: 'light' });
        } catch {
            try {
                wx.vibrateShort();
            } catch {
                /* 静默 */
            }
        }
    }

    /** 大连锁时的中等震动 */
    medium(): void {
        if (!this._enabled) return;
        const wx = this._wx;
        if (!wx || typeof wx.vibrateShort !== 'function') return;
        try {
            wx.vibrateShort({ type: 'medium' });
        } catch {
            /* 静默 */
        }
    }

    get enabled(): boolean {
        return this._enabled && TUNING.fx.shakeOnChain;
    }
}

export const haptic = new HapticServiceImpl();
