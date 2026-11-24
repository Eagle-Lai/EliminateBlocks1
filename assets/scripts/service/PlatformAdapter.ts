/**
 * 平台隔离层：所有微信 API 只出现在这里，业务层不感知平台差异。
 * 非微信环境（浏览器预览 / 编辑器）全部走空实现，保证同一套代码可跑。
 */
import { sys } from 'cc';
import { Logger } from '../utils/Logger';

interface SafeInsets {
    top: number;
    bottom: number;
}

class PlatformAdapterImpl {
    private get _wx(): any {
        return (globalThis as any).wx ?? null;
    }

    get isWechat(): boolean {
        return !!this._wx || sys.platform === sys.Platform.WECHAT_GAME;
    }

    /**
     * 计算安全区内边距（设计分辨率单位）。
     * 竖屏 FIXED_WIDTH 下，横向缩放比 = 设计宽 / 屏幕物理宽。
     */
    getSafeInsets(designWidth: number): SafeInsets {
        const wx = this._wx;
        if (!wx || typeof wx.getSystemInfoSync !== 'function') {
            return { top: 0, bottom: 0 };
        }
        try {
            const info = wx.getSystemInfoSync();
            const screenWidth = info.screenWidth || info.windowWidth || designWidth;
            const screenHeight = info.screenHeight || info.windowHeight || 0;
            const scale = designWidth / screenWidth;
            const safeArea = info.safeArea;
            const topPx = safeArea ? safeArea.top : info.statusBarHeight || 0;
            const bottomPx = safeArea ? Math.max(0, screenHeight - safeArea.bottom) : 0;
            return {
                top: Math.max(0, topPx * scale),
                bottom: Math.max(0, bottomPx * scale),
            };
        } catch (err) {
            Logger.warn('Platform', '读取安全区失败', err);
            return { top: 0, bottom: 0 };
        }
    }

    shareScore(score: number, level: number): void {
        const wx = this._wx;
        if (!wx || typeof wx.shareAppMessage !== 'function') return;
        try {
            wx.shareAppMessage({
                title: `我在落块消消拿了 ${score} 分，等级 ${level}，来试试？`,
                query: `score=${score}&level=${level}`,
            });
        } catch (err) {
            Logger.warn('Platform', '分享失败', err);
        }
    }

    /** 预留：激励视频复活。本期固定返回 false，不接入广告。 */
    showRewardedVideo(): Promise<boolean> {
        return Promise.resolve(false);
    }

    /** 预留：开放数据域排行榜 */
    openLeaderboard(): void {
        Logger.info('Platform', '排行榜为二期功能');
    }

    enableShareMenu(): void {
        const wx = this._wx;
        if (!wx || typeof wx.showShareMenu !== 'function') return;
        try {
            wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
        } catch {
            /* 静默 */
        }
    }

    onMemoryWarning(cb: () => void): void {
        const wx = this._wx;
        if (!wx || typeof wx.onMemoryWarning !== 'function') return;
        wx.onMemoryWarning(cb);
    }
}

export const platform = new PlatformAdapterImpl();
