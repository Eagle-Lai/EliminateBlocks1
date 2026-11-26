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
import { BootView } from '../view/BootView';
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
import { ART, PRELOAD_FRAMES, SFX_PATHS } from '../config/AssetKeys';

const { ccclass, property } = _decorator;

@ccclass('GameEntry')
export class GameEntry extends Component {
    @property(Node) uiRoot: Node | null = null;

    private _layout: LayoutInfo | null = null;
    private _booted = false;
    private _frames: (SpriteFrame | null)[] = [];
    private _route = 0;
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

        this._onResize();

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
        doc.title = '落块消消';
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

        const boot = await manager.open<BootView>('boot', '版本 2.0.0');
        const total = PRELOAD_FRAMES.length + Object.keys(SFX_PATHS).length + BOOT_PREFABS.length + 1;
        let finished = 0;
        const advance = () => boot?.setProgress(++finished / total);

        await Promise.all([
            assets.preloadFrames(PRELOAD_FRAMES, advance),
            audio.preload(advance),
        ]);
        boot?.setProgress(finished / total, '布置棋盘…');
        await assets.preloadPrefabs(BOOT_PREFABS, advance);

        const blockFrames = await Promise.all(ART.blocks.map((p) => assets.loadSpriteFrame(p)));
        this._frames = blockFrames;
        boot?.setProgress(1, '准备就绪');

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
        return storage.levelProgress().stars;
    }

    private _coins(): number {
        return storage.getNumber(StorageKey.Coins, 0);
    }

    private async _openHome(): Promise<void> {
        const route = ++this._route;
        this._replay = null;
        const manager = UIManager.instance;
        if (!manager) return;
        manager.closeLayer('popup');
        manager.closeLayer('scene');
        const view = await manager.open<HomeView>('home', {
            coins: this._coins(),
            best: storage.getNumber(StorageKey.BestScore, 0),
        });
        if (route !== this._route) return;
        view?.bind({
            onEndless: () => nav.startEndless(),
            onLevels: () => nav.toChapter(1),
            onDaily: () => nav.toDaily(),
            onSettings: () => nav.openSettings(),
        });
        audio.playBgm('home', 500);
    }

    private async _openChapter(chapter: number): Promise<void> {
        const route = ++this._route;
        const manager = UIManager.instance;
        const view = await manager?.open<ChapterMapView>('chapterMap', { stars: this._stars(), chapter });
        if (route !== this._route) return;
        view?.bind({
            onBack: () => nav.toHome(),
            onSelectLevel: (id) => nav.startLevel(id),
        });
    }

    private async _openDaily(): Promise<void> {
        const route = ++this._route;
        const manager = UIManager.instance;
        manager?.closeLayer('scene');
        const view = await manager?.open<DailyPanelView>('dailyPanel');
        if (route !== this._route) return;
        view?.bind({
            onPlay: (day, year) => void this._startDaily(day, year),
            onHint: () => void manager?.toast('开始挑战后，点棋盘右侧的灯泡查看提示'),
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
        const route = ++this._route;
        const record = replayStore.best();
        if (!record) {
            await UIManager.instance?.toast('还没有可回放的记录');
            return;
        }
        const view = await UIManager.instance?.open<ReplayView>('replay', { title: `最佳局 ${record.score}` });
        if (!view || route !== this._route) return;
        this._replay = new ReplayController(view, record, this._frames);
        await this._replay.start();
    }

    private async _openGameScreen(route: number): Promise<GameScreenView | null> {
        const manager = UIManager.instance;
        if (!manager) return null;
        manager.closeLayer('popup');
        manager.closeLayer('scene');
        const view = await manager.open<GameScreenView>('gameScreen');
        if (route !== this._route) return null;
        if (!view) {
            await this._openHome();
            if (this._route === route + 1) await manager.toast('棋盘加载失败，请重试');
            return null;
        }
        manager.close('home');
        return view;
    }

    /** 资源分包加载：失败给用户明确反馈（此前是未处理 rejection，界面无响应感）。 */
    private async _loadBundleSafe(bundle: string, route: number): Promise<boolean> {
        try {
            if (await assets.loadBundle(bundle)) return true;
            if (route !== this._route) return false;
            await UIManager.instance?.toast('资源加载失败，请重试');
            return false;
        } catch (err) {
            if (route !== this._route) return false;
            Logger.error('GameEntry', `分包加载失败：${bundle}`, err);
            await UIManager.instance?.toast('资源加载失败，请重试');
            return false;
        }
    }

    private async _startEndless(): Promise<void> {
        const route = ++this._route;
        if (!(await this._loadBundleSafe('ch1', route))) return;
        if (route !== this._route) return;
        const view = await this._openGameScreen(route);
        if (route !== this._route || !view || !this._layout) return;
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
        const route = ++this._route;
        const level = LEVELS.find((l) => l.id === id);
        if (!level) return;
        if (!(await this._loadBundleSafe(`ch${level.chapter}`, route))) return;
        if (route !== this._route) return;
        const view = await this._openGameScreen(route);
        if (route !== this._route || !view || !this._layout) return;
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

    private async _startDaily(day: number, puzzleYear = new Date().getFullYear()): Promise<void> {
        const route = ++this._route;
        const puzzle = puzzleForDay(day);
        if (!puzzle) {
            await UIManager.instance?.toast('题目加载失败，请重试');
            return;
        }
        if (!(await this._loadBundleSafe('daily', route))) return;
        if (route !== this._route) return;
        const view = await this._openGameScreen(route);
        if (route !== this._route || !view || !this._layout) return;
        const controller = view.node.getComponent(GameController);
        if (!controller) return;
        UIManager.instance?.close('dailyPanel');
        controller.boot({
            view,
            layout: this._layout,
            frames: this._frames,
            config: dailyConfig(puzzle, puzzleYear),
            best: storage.getNumber(StorageKey.BestScore, 0),
        });
        audio.playBgm('home', 400);
    }

    update(dt: number): void {
        this._replay?.update(dt);
    }

    private _onResize(): void {
        const width = TUNING.ui.designWidth;
        const baseRatio = TUNING.ui.designHeight / width;
        const size = screen.windowSize;
        // The CSS canvas itself can already be letterboxed. Measure its window.
        const w = sys.isBrowser && typeof window !== 'undefined' ? window.innerWidth : size.width;
        const h = sys.isBrowser && typeof window !== 'undefined' ? window.innerHeight : size.height;
        const ratio = w > 0 && h > 0 ? h / w : baseRatio;
        const portrait = ratio < baseRatio - 0.005;
        const height = Math.round(width * Math.min(TUNING.ui.maxAspect, Math.max(baseRatio, ratio)));
        const insets = platform.getSafeInsets(width);
        const previous = this._layout;
        const resolutionChanged = portrait !== this._portraitCanvas || previous?.height !== height;
        const layoutChanged = resolutionChanged || previous?.safeTop !== insets.top || previous?.safeBottom !== insets.bottom;
        this._portraitCanvas = portrait;
        if (layoutChanged) this._layout = LayoutAdapter.compute(width, height, insets.top, insets.bottom);
        if (resolutionChanged) view.setDesignResolutionSize(width, height, portrait ? GameEntry._portraitPolicy() : GameEntry._fillPolicy());
        this._syncCanvas();
        if (layoutChanged && this._layout) {
            UIManager.instance?.get<GameScreenView>('gameScreen')?.node.getComponent(GameController)?.relayout(this._layout);
        }
    }

    onDestroy(): void {
        view.off('canvas-resize', this._onResize, this);
        UIView.host = null;
    }
}
