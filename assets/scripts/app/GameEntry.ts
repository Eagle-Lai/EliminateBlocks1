/**
 * 游戏入口：设置分辨率与安全区 → 预加载美术 → 构建背景 → 启动主控制器。
 * 同时负责平台侧的一次性初始化（分享菜单、内存告警）。
 */
import {
    _decorator,
    Canvas,
    Color,
    Component,
    Graphics,
    Node,
    ResolutionPolicy,
    Sprite,
    profiler,
    SpriteFrame,
    screen,
    sys,
    UITransform,
    view,
} from 'cc';
import { TUNING } from '../config/GameTuning';
import { THEME } from '../config/ThemeConfig';
import { LayoutAdapter, type LayoutInfo } from '../ui/LayoutAdapter';
import { createLabel, createNode, setSize } from '../ui/UIFactory';
import { assets } from '../service/AssetService';
import { audio } from '../service/AudioService';
import { platform } from '../service/PlatformAdapter';
import { storage, StorageKey } from '../service/StorageService';
import { Logger } from '../utils/Logger';
import { GameController } from '../controller/GameController';

const { ccclass } = _decorator;

/** 背景美术原始尺寸（assets/resources/art/bg/bg_main.jpg），用于等比铺满 */
const ART_W = 750;
const ART_H = 1334;
/** 背景铺满时允许的最大放大倍数：窗口特别宽时不再继续放大，多余部分用底色补齐 */
const MAX_COVER_SCALE = 1.35;

@ccclass('GameEntry')
export class GameEntry extends Component {
    private _started = false;
    private _splashNodes: Node[] = [];
    private _layout: LayoutInfo | null = null;
    private _bgRoot: Node | null = null;
    private _bgFill: Node | null = null;
    private _bgFillG: Graphics | null = null;
    private _bgArt: Node | null = null;
    private _bgFrame: SpriteFrame | null = null;
    /** 当前画布是否已收成竖屏框（PROPORTION_TO_FRAME） */
    private _portraitCanvas = false;

    /** 画布收成竖屏框（竖屏游戏在宽窗口下的正确形态） */
    private static _portraitPolicy(): ResolutionPolicy {
        return new ResolutionPolicy(
            ResolutionPolicy.ContainerStrategy.PROPORTION_TO_FRAME,
            ResolutionPolicy.ContentStrategy.SHOW_ALL,
        );
    }

    /** 画布铺满窗口（手机/竖屏窗口），设计高度跟随窗口比例 */
    private static _fillPolicy(): ResolutionPolicy {
        return new ResolutionPolicy(
            ResolutionPolicy.ContainerStrategy.EQUAL_TO_FRAME,
            ResolutionPolicy.ContentStrategy.SHOW_ALL,
        );
    }

    onLoad(): void {
        // 保险：同一个节点上被手工挂了多个 GameEntry（编辑器里重复 Add Component）时，
        // 只让第一个生效，其余自毁，否则会重复建背景/UI、重复播音频、重复开对局。
        const siblings = this.node.getComponents(GameEntry);
        if (siblings.length > 1 && siblings[0] !== this) {
            Logger.warn('GameEntry', `节点上存在 ${siblings.length} 个 GameEntry，已忽略重复组件`);
            this.destroy();
            return;
        }

        // 关闭调试性能面板，避免遮挡底部操作区（发布包本来也不开）
        profiler.hideStats();

        const designWidth = TUNING.ui.designWidth;
        const designHeight = TUNING.ui.designHeight;
        const designRatio = designHeight / designWidth;

        const win = screen.windowSize;
        const winRatio = win.width > 0 && win.height > 0 ? win.height / win.width : designRatio;

        // 本作是竖屏游戏，所以**画布本身也要是竖屏的**：
        // · 窗口比设计比例更"宽/矮"（桌面浏览器、编辑器预览、横屏窗口）→ 把画布收成 750×1334 的竖屏框居中，
        //   画布外由页面底色填充，而不是把竖屏 UI 塞进一块横屏画布、只在中间露出一条；
        // · 窗口本来就够高（手机、竖屏窗口）→ 画布铺满窗口，设计高度跟随窗口比例微调。
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
        const layout = LayoutAdapter.compute(designWidth, layoutHeight, insets.top, insets.bottom);
        this._layout = layout;

        // 画布收窄后，四周是页面（浏览器/编辑器预览）而不是游戏画面：把页面底色也刷成糖果底色，
        // 再把相机清屏色对齐，任何窗口比例下都不会出现"黑边"。
        this._paintPageBackdrop();
        this._paintBackdrop();
        this._buildBackground(layout);

        this._buildSplash(layout);

        platform.enableShareMenu();
        platform.onMemoryWarning(() => {
            // 本作常驻资源仅 6 张图 + 10 个短音效（合计 < 2MB），
            // 收到告警时只记录；真正的释放发生在场景切换（GameEntry.onDestroy）。
            Logger.warn('Memory', '收到内存告警，当前常驻资源体量较小，保持现状');
        });

        // 窗口尺寸变化时只刷新背景与清屏色（UI 布局仍按启动时的设计框，避免整棵 UI 重排）
        view.on('canvas-resize', this._onResize, this);

        void this._boot(layout);
    }

    /**
     * 场景里 Canvas 固定按竖屏基准尺寸（750×1334）摆放，不再挂四边拉伸的 Widget
     * （Widget 会把它拉到"设计分辨率"，编辑器里设置还是横屏时就把 Canvas 显示成横的）。
     * 这里按当前可视区域同步它的尺寸与位置，等价于 Widget 的拉伸效果。
     */
    private _syncCanvas(): void {
        const size = view.getVisibleSize();
        const ut = this.getComponent(UITransform);
        if (ut) ut.setContentSize(Math.round(size.width), Math.round(size.height));
        this.node.setPosition(size.width / 2, size.height / 2, 0);
    }

    /** 留边区域由相机清屏色填充，用背景底色代替默认黑色 */
    private _paintBackdrop(): void {
        const canvas = this.getComponent(Canvas);
        const camera = canvas ? canvas.cameraComponent : null;
        if (camera) camera.clearColor = THEME.bgEdge;
    }

    /** web 平台：把页面（画布外）底色也刷成糖果底色，竖屏画布两侧不是黑边 */
    private _paintPageBackdrop(): void {
        if (!sys.isBrowser) return;
        const doc = (globalThis as { document?: Document }).document;
        if (!doc) return;
        const css = `rgb(${THEME.bgEdge.r}, ${THEME.bgEdge.g}, ${THEME.bgEdge.b})`;
        doc.documentElement.style.backgroundColor = css;
        if (doc.body) doc.body.style.backgroundColor = css;
    }

    private _buildBackground(layout: LayoutInfo): void {
        // 容器本身不挂渲染器：底色与美术各占一个子节点，避免"同节点只能有一个 UIRenderer"
        const root = createNode('Background', this.node);
        root.setSiblingIndex(0);
        this._bgRoot = root;

        const fill = createNode('BgFill', root);
        this._bgFill = fill;
        this._bgFillG = fill.addComponent(Graphics);

        const art = createNode('BgArt', root);
        this._bgArt = art;
        const sprite = art.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;

        this._applyBackgroundSize(layout);

        assets.loadSpriteFrame(THEME.art.bg).then((sf: SpriteFrame | null) => {
            if (!sf || !this._bgArt) return;
            this._bgFrame = sf;
            sprite.spriteFrame = sf;
            this._applyBackgroundSize(layout);
        });
    }

    /** 让底色铺满可视区域、背景图等比覆盖（窗口特别宽时不再放大，多余部分由底色补齐） */
    private _applyBackgroundSize(layout: LayoutInfo): void {
        const viewport = LayoutAdapter.viewport(layout.width, layout.height);
        const w = Math.max(layout.width, viewport.width) + 16;
        const h = Math.max(layout.height, viewport.height) + 16;

        if (this._bgRoot) setSize(this._bgRoot, w, h);

        const g = this._bgFillG;
        if (this._bgFill && g) {
            setSize(this._bgFill, w, h);
            g.clear();
            g.fillColor = THEME.bgEdge;
            g.rect(-w / 2, -h / 2, w, h);
            g.fill();
            // 装饰光斑按设计框尺寸绘制：正常情况下被背景图盖住，只在很宽的窗口两侧露出一点柔光
            g.fillColor = new Color(255, 255, 255, 60);
            g.circle(0, layout.height * 0.34, layout.width * 0.62);
            g.fill();
            g.fillColor = new Color(255, 222, 186, 90);
            g.circle(-layout.width * 0.42, -layout.height * 0.38, layout.width * 0.5);
            g.fill();
        }

        if (this._bgArt) {
            const frame = this._bgFrame;
            if (frame) {
                const artW = frame.originalSize.width || ART_W;
                const artH = frame.originalSize.height || ART_H;
                const cover = Math.min(MAX_COVER_SCALE, Math.max(w / artW, h / artH));
                setSize(this._bgArt, artW * cover, artH * cover);
            } else {
                setSize(this._bgArt, w, h);
            }
        }
    }

    private _onResize(): void {
        if (!this._layout) return;

        // 窗口从"竖屏"被拉宽时，把画布重新收成竖屏框。
        // 只在设计框仍是基准竖屏尺寸（没有按窗口比例拉高）时才切，这样 UI 不用重排。
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

        this._applyBackgroundSize(this._layout);
        this._syncCanvas();
    }

    private _buildSplash(layout: LayoutInfo): void {
        const title = createLabel(this.node, '落块消消', {
            size: 64,
            bold: true,
            width: layout.width - 80,
            height: 86,
        });
        title.node.setPosition(0, 40, 0);
        const sub = createLabel(this.node, '正在准备糖果…', {
            size: 20,
            color: THEME.textSecondary,
            width: layout.width - 80,
        });
        sub.node.setPosition(0, -30, 0);
        this._splashNodes.push(title.node, sub.node);
    }

    private async _boot(layout: LayoutInfo): Promise<void> {
        if (this._started) return;
        this._started = true;

        audio.init(this.node);
        audio.unlock();
        await audio.preload();

        const blockFrames = await Promise.all(
            THEME.art.blocks.map((path) => assets.loadSpriteFrame(path)),
        );

        const best = storage.getNumber(StorageKey.BestScore, 0);

        const root = createNode('GameRoot', this.node);
        setSize(root, layout.width, layout.height);
        const controller = root.addComponent(GameController);
        controller.boot({ layout, frames: blockFrames, best });

        for (const node of this._splashNodes) node.destroy();
        this._splashNodes.length = 0;
    }

    onDestroy(): void {
        view.off('canvas-resize', this._onResize, this);
    }
}
