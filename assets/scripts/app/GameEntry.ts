/**
 * 游戏入口：设置分辨率与安全区 → 预载资源 → 启动页 → 首页 → 各模式。
 * 不再创建背景 / splash / GameRoot：所有界面都来自 Prefab，由 UIRoot 的四层承载。
 */
import {
    _decorator,
    Canvas,
    Color,
    Component,
    Node,
    ResolutionPolicy,
    SpriteFrame,
    profiler,
    screen,
    sys,
    view,
} from 'cc';
import { TUNING } from '../config/GameTuning';
import { THEME } from '../config/ThemeConfig';
import { LayoutAdapter, type LayoutInfo } from '../ui/LayoutAdapter';
import { assets } from '../service/AssetService';
import { audio } from '../service/AudioService';
import { platform } from '../service/PlatformAdapter';
import { storage, StorageKey } from '../service/StorageService';
import { Logger } from '../utils/Logger';
import { UIManager } from '../ui/UIManager';
import { UIView } from '../ui/UIView';
import { GameScreenView } from '../view/GameScreenView';
import { HomeView } from '../view/HomeView';
import { ChapterMapView } from '../view/ChapterMapView';
import { DailyPanelView } from '../view/DailyPanelView';
import { SettingsView } from '../view/SettingsView';
import { ReplayView } from '../view/ReplayView';
import { GameController } from '../controller/GameController';
import { ReplayController } from '../controller/ReplayController';
import { nav, setNavigator } from './Navigator';
import { endlessConfig, dailyConfig, levelConfig } from './GameMode';
import { LEVELS } from '../config/LevelTable';
import { puzzleForDay } from './DailyRepo';
import { replayStore } from '../service/ReplayStore';
import { BOOT_PREFABS } from '../config/UIPrefabs';
import { ART, PRELOAD_FRAMES } from '../config/AssetKeys';

const { ccclass, property } = _decorator;

@ccclass('GameEntry')
export class GameEntry extends Component {
    @property(Node) uiRoot: Node | null = null;

    private _layout: LayoutInfo | null = null;
    private _booted = false;
    private _frames: (SpriteFrame | null)[] = [];
    private _portraitCanvas = false;
    private _replay: ReplayController | null = null;

    private static _portraitPolicy(): ResolutionPolicy {
        return new ResolutionPolicy(
            ResolutionPolicy.ContainerStrategy.PROPORTION_TO_FRAME,
            ResolutionPolicy.ContentStrategy.SHOW_ALL,
        );
    }

    private static _fillPolicy(): ResolutionPolicy {
        return new ResolutionPolicy(
            ResolutionPolicy.ContainerStrategy.EQUAL_TO_FRAME,
            ResolutionPolicy.ContentStrategy.SHOW_ALL,
        );
    }

    onLoad(): void {
        const siblings = this.node.getComponents(GameEntry);
        if (siblings.length > 1 && siblings[0] !== this) {
            Logger.warn('GameEntry', `节点上存在 ${siblings.length} 个 GameEntry，已忽略重复组件`);
            this.destroy();
            return;
        }
        profiler.hideStats();

        const designWidth = TUNING.ui.designWidth;
        const designHeight = TUNING.ui.designHeight;
        const designRatio = designHeight / designWidth;
        const win = screen.windowSize;
        const winRatio = win.width > 0 && win.height > 0 ? win.height / win.width : designRatio;
        const portraitCanvas = winRatio < designRatio - 0.005;
        this._portraitCanvas = portraitCanvas;

        let layoutHeight: number = designHeight;
        let policy: ResolutionPolicy;
        if (portraitCanvas) {
            policy = GameEntry._portraitPolicy();
        } else {
            const aspect = Math.min(TUNING.ui.maxAspect, Math.max(designRatio, winRatio));
            layoutHeight = Math.round(designWidth * aspect);
            policy = GameEntry._fillPolicy();
        }
        view.setDesignResolutionSize(designWidth, layoutHeight, policy);
        this._syncCanvas();

        const insets = platform.getSafeInsets(designWidth);
        this._layout = LayoutAdapter.compute(designWidth, layoutHeight, insets.top, insets.bottom);

        this._paintPageBackdrop();
        this._paintBackdrop();
        platform.enableShareMenu();
        platform.onMemoryWarning(() => Logger.warn('Memory', '收到内存告警'));
        view.on('canvas-resize', this._onResize, this);

        void this._boot();
    }

    private _syncCanvas(): void {
        const size = view.getVisibleSize();
        const transform = this.getComponent('cc.UITransform') as unknown as {
            setContentSize: (w: number, h: number) => void;
        } | null;
        if (transform) transform.setContentSize(Math.round(size.width), Math.round(size.height));
        this.node.setPosition(size.width / 2, size.height / 2, 0);
    }

    private _paintBackdrop(): void {
        const canvas = this.getComponent(Canvas);
        const camera = canvas ? canvas.cameraComponent : null;
        if (camera) camera.clearColor = THEME.bgEdge;
    }

    private _paintPageBackdrop(): void {
        if (!sys.isBrowser) return;
        const doc = (globalThis as { document?: Document }).document;
        if (!doc) return;
        const css = `rgb(${THEME.bgEdge.r}, ${THEME.bgEdge.g}, ${THEME.bgEdge.b})`;
        doc.documentElement.style.backgroundColor = css;
        if (doc.body) doc.body.style.backgroundColor = css;
    }

    private async _boot(): Promise<void> {
        if (this._booted) return;
        this._booted = true;
        const root = this.uiRoot ?? this.node.getChildByName('UIRoot');
        if (!root) {
            Logger.error('GameEntry', '场景缺少 UIRoot');
            return;
        }
        const manager = root.getComponent(UIManager);
        if (!manager) {
            Logger.error('GameEntry', 'UIRoot 缺少 UIManager');
            return;
        }

        audio.init(this.node);
        audio.unlock();
        const muted = storage.getBool(StorageKey.Muted, false);
        audio.setMuted(muted);

        await manager.open('boot', 'v2.0.0');
        const boot = manager.get('boot') as unknown as { setProgress?: (p: number, tip?: string) => void } | null;
        boot?.setProgress?.(0.1, '加载图集…');

        await Promise.all([
            assets.preloadFrames(PRELOAD_FRAMES),
            audio.preload(),
        ]);
        boot?.setProgress?.(0.55, '加载界面…');
        await assets.preloadPrefabs(BOOT_PREFABS);

        const blockFrames = await Promise.all(ART.blocks.map((p) => assets.loadSpriteFrame(p)));
        this._frames = blockFrames;
        boot?.setProgress?.(0.9, '准备就绪…');

        this._registerNavigator();
        await this._openHome();
    }

    private _registerNavigator(): void {
        setNavigator({
            toHome: () => void this._openHome(),
            toChapter: (chapter?: number) => void this._openChapter(chapter ?? 1),
            toDaily: () => void this._openDaily(),
            startLevel: (id: number) => void this._startLevel(id),
            startDaily: (day: number) => void this._startDaily(day),
            startEndless: () => void this._startEndless(),
            openReplay: () => void this._openReplay(),
            openSettings: () => void this._openSettings(),
        });
    }

    private _stars(): Record<number, number> {
        return storage.getJson<{ stars: Record<number, number> }>(StorageKey.LevelStars, { stars: {} }).stars ?? {};
    }

    private _coins(): number {
        return storage.getNumber(StorageKey.Coins, 0);
    }

    private async _openHome(): Promise<void> {
        this._replay = null;
        const manager = UIManager.instance;
        if (!manager) return;
        manager.closeLayer('scene');
        const view = await manager.open<HomeView>('home', {
            coins: this._coins(),
            best: storage.getNumber(StorageKey.BestScore, 0),
            replayAvailable: replayStore.list().length > 0,
        });
        view?.bind({
            onEndless: () => nav.startEndless(),
            onLevels: () => nav.toChapter(1),
            onDaily: () => nav.toDaily(),
            onReplay: () => nav.openReplay(),
            onSettings: () => nav.openSettings(),
        });
        audio.playBgm('home', 500);
    }

    private async _openChapter(chapter: number): Promise<void> {
        const manager = UIManager.instance;
        const view = await manager?.open<ChapterMapView>('chapterMap', { stars: this._stars(), chapter });
        view?.bind({
            onBack: () => nav.toHome(),
            onSelectLevel: (id) => nav.startLevel(id),
        });
    }

    private async _openDaily(): Promise<void> {
        const manager = UIManager.instance;
        const view = await manager?.open<DailyPanelView>('dailyPanel', {
            done: replayStore.dailyDone(),
            streak: replayStore.streak(),
        });
        view?.bind({
            onPlay: (day) => nav.startDaily(day),
            onHint: () => void manager?.toast('提示功能为 P2，本轮仅保留配置位'),
            onBack: () => nav.toHome(),
        });
    }

    private async _openSettings(): Promise<void> {
        const manager = UIManager.instance;
        const view = await manager?.open<SettingsView>('settings', { muted: audio.muted });
        view?.bind({
            onToggleMute: () => {
                const next = !audio.muted;
                audio.setMuted(next);
                storage.set(StorageKey.Muted, next);
                return next;
            },
            onBack: () => manager?.close('settings'),
        });
    }

    private async _openReplay(): Promise<void> {
        const record = replayStore.latest();
        if (!record) {
            await UIManager.instance?.toast('还没有可回放的记录');
            return;
        }
        const view = await UIManager.instance?.open<ReplayView>('replay', { title: `最佳局 ${record.score}` });
        if (!view) return;
        this._replay = new ReplayController(view, record, this._frames);
        await this._replay.start();
    }

    private async _openGameScreen(): Promise<GameScreenView | null> {
        const manager = UIManager.instance;
        if (!manager) return null;
        manager.close('home');
        const view = await manager.open<GameScreenView>('gameScreen');
        return view;
    }

    private async _startEndless(): Promise<void> {
        await assets.loadBundle('ch1');
        const view = await this._openGameScreen();
        if (!view || !this._layout) return;
        const controller = view.node.getComponent(GameController);
        if (!controller) {
            Logger.error('GameEntry', 'GameScreen 缺少 GameController');
            return;
        }
        controller.boot({
            view,
            layout: this._layout,
            frames: this._frames,
            config: endlessConfig(Date.now()),
            best: storage.getNumber(StorageKey.BestScore, 0),
        });
        audio.playBgm('ch1', 400);
    }

    private async _startLevel(id: number): Promise<void> {
        const level = LEVELS.find((l) => l.id === id);
        if (!level) return;
        await assets.loadBundle(`ch${level.chapter}`);
        const view = await this._openGameScreen();
        if (!view || !this._layout) return;
        const controller = view.node.getComponent(GameController);
        if (!controller) return;
        UIManager.instance?.close('chapterMap');
        controller.boot({
            view,
            layout: this._layout,
            frames: this._frames,
            config: levelConfig(level),
            best: storage.getNumber(StorageKey.BestScore, 0),
        });
        audio.playBgm(`ch${level.chapter}` as never, 400);
    }

    private async _startDaily(day: number): Promise<void> {
        const puzzle = puzzleForDay(day);
        if (!puzzle) {
            await UIManager.instance?.toast('题目加载失败，请重试');
            return;
        }
        await assets.loadBundle('daily');
        const view = await this._openGameScreen();
        if (!view || !this._layout) return;
        const controller = view.node.getComponent(GameController);
        if (!controller) return;
        UIManager.instance?.close('dailyPanel');
        controller.boot({
            view,
            layout: this._layout,
            frames: this._frames,
            config: dailyConfig(puzzle),
            best: storage.getNumber(StorageKey.BestScore, 0),
        });
        audio.playBgm('home', 400);
    }

    update(dt: number): void {
        this._replay?.update(dt);
    }

    private _onResize(): void {
        if (!this._layout) return;
        if (!this._portraitCanvas && this._layout.height === TUNING.ui.designHeight) {
            const win = screen.windowSize;
            const winRatio = win.width > 0 && win.height > 0 ? win.height / win.width : 1;
            if (winRatio < TUNING.ui.designHeight / TUNING.ui.designWidth) {
                this._portraitCanvas = true;
                view.setDesignResolutionSize(
                    TUNING.ui.designWidth,
                    TUNING.ui.designHeight,
                    GameEntry._portraitPolicy(),
                );
                this._paintBackdrop();
            }
        }
        this._syncCanvas();
    }

    onDestroy(): void {
        view.off('canvas-resize', this._onResize, this);
        UIView.host = null;
    }
}
