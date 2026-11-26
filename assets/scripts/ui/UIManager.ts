/**
 * UI 管理器：层栈、Prefab 加载/实例化、open/close/closeTop/closeAll、toast。
 * 只操作 Prefab 实例，不拼界面。Panel 最多 1 个、Popup 最多 1 个、Toast ≤2。
 */
import { _decorator, BlockInputEvents, Color, Component, Node, Prefab, Sprite, Tween, UIOpacity, UITransform, Vec2, Vec3, instantiate, tween } from 'cc';
import { PREFAB_MAP, type UILayer } from '../config/UIPrefabs';
import { assets } from '../service/AssetService';
import { audio } from '../service/AudioService';
import { Logger } from '../utils/Logger';
import { UIView } from './UIView';

const { ccclass, property } = _decorator;

interface OpenEntry {
    key: string;
    view: UIView;
    layer: UILayer;
    entry: (typeof PREFAB_MAP)[string];
}

@ccclass('UIManager')
export class UIManager extends Component {
    static instance: UIManager | null = null;

    @property(Node) layerScene: Node | null = null;
    @property(Node) layerPanel: Node | null = null;
    @property(Node) layerPopup: Node | null = null;
    @property(Node) layerToast: Node | null = null;

    private _open: OpenEntry[] = [];
    private _cached = new Map<string, UIView>();
    private _requests = new Map<string, number>();
    private _sequence = 0;
    private _touchRipple: Node | null = null;

    onLoad(): void {
        UIManager.instance = this;
        UIView.host = this;
        if (!this.layerScene || !this.layerPanel || !this.layerPopup || !this.layerToast) {
            Logger.error('UIManager', 'UIRoot 四层未绑定');
        }
    }

    onDestroy(): void {
        this._requests.clear();
        const opacity = this._touchRipple?.isValid ? this._touchRipple.getComponent(UIOpacity) : null;
        if (opacity) Tween.stopAllByTarget(opacity);
        if (UIManager.instance === this) UIManager.instance = null;
        if (UIView.host === this) UIView.host = null;
    }

    /** 放在顶层并复用一个冲击波，页面切换时仍能看见手指落点。 */
    rippleAt(point: Vec2): void {
        const layer = this.layerToast;
        if (!layer) return;
        if (!this._touchRipple) {
            const prefab = assets.getPrefab('prefabs/fx/ShockwaveFx');
            if (!prefab) return;
            const ripple = instantiate(prefab);
            ripple.name = 'TouchRipple';
            ripple.setParent(layer);
            const sprite = ripple.getComponent(Sprite);
            if (sprite) sprite.color = new Color(169, 243, 255, 255);
            this._touchRipple = ripple;
        }
        const ripple = this._touchRipple;
        const opacity = ripple.getComponent(UIOpacity) ?? ripple.addComponent(UIOpacity);
        Tween.stopAllByTarget(ripple);
        Tween.stopAllByTarget(opacity);
        ripple.active = true;
        ripple.setWorldPosition(point.x, point.y, layer.worldPosition.z);
        ripple.setScale(0.15, 0.15, 1);
        opacity.opacity = 250;
        tween(ripple).to(0.32, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'quadOut' }).start();
        tween(opacity).delay(0.055).to(0.265, { opacity: 0 })
            .call(() => { ripple.active = false; }).start();
    }

    get<T extends UIView = UIView>(key: string): T | null {
        for (let i = this._open.length - 1; i >= 0; i--) {
            if (this._open[i].key === key) return this._open[i].view as T;
        }
        return null;
    }

    private _layerNode(layer: UILayer): Node | null {
        switch (layer) {
            case 'scene':
                return this.layerScene;
            case 'panel':
                return this.layerPanel;
            case 'popup':
                return this.layerPopup;
            case 'toast':
                return this.layerToast;
            default:
                return null;
        }
    }

    async open<T extends UIView = UIView>(key: string, data?: unknown): Promise<T | null> {
        const entry = PREFAB_MAP[key];
        if (!entry) {
            Logger.error('UIManager', `未注册的 Prefab 键：${key}`);
            return null;
        }
        if (entry.layer === 'panel' || entry.layer === 'popup') this._cancelPending(entry.layer);
        const request = ++this._sequence;
        this._requests.set(key, request);
        const existing = this.get<T>(key);
        if (existing) {
            this._requests.delete(key);
            existing.node.active = true;
            existing.onOpen(data);
            return existing;
        }
        try {
            return (await this._createView(key, entry, request, data)) as T | null;
        } finally {
            if (this._requests.get(key) === request) this._requests.delete(key);
        }
    }

    private async _createView(key: string, entry: (typeof PREFAB_MAP)[string], request: number, data?: unknown): Promise<UIView | null> {
        const prefab: Prefab | null = await assets.loadPrefab(entry.path);
        if (this._requests.get(key) !== request) return null;
        if (!prefab) {
            Logger.error('UIManager', `Prefab 加载失败：${entry.path}`);
            return null;
        }
        const layerNode = this._layerNode(entry.layer);
        if (!layerNode) {
            Logger.error('UIManager', `层未绑定：${entry.layer}`);
            return null;
        }

        // 层互斥：Panel 只留一个；Popup 只留一个
        if (entry.layer === 'panel' || entry.layer === 'popup') {
            for (const item of this._open.slice()) if (item.layer === entry.layer) this.close(item.key);
        }
        if (entry.layer === 'toast') {
            const toasts = this._open.filter((o) => o.layer === 'toast');
            while (toasts.length >= 2) {
                const oldest = toasts.shift();
                if (oldest) this.close(oldest.key);
            }
        }

        const cached = this._cached.get(key);
        this._cached.delete(key);
        const node = cached?.isValid ? cached.node : instantiate(prefab);
        if (entry.modal && !node.getComponent(BlockInputEvents)) node.addComponent(BlockInputEvents);
        node.setParent(layerNode);
        node.setSiblingIndex(layerNode.children.length - 1);
        node.setPosition(0, 0, 0);
        const ut = node.getComponent(UITransform);
        if (ut) ut.setAnchorPoint(0.5, 0.5);

        let view = node.getComponent(UIView);
        if (!view) {
            Logger.error('UIManager', `Prefab 根节点缺少 UIView：${entry.path}`);
            node.destroy();
            return null;
        }
        view.key = key;
        view.layer = entry.layer;
        view.node.active = true;

        this._open.push({ key, view, layer: entry.layer, entry });
        try {
            view.onOpen(data);
        } catch (err) {
            Logger.error('UIManager', `onOpen 失败：${key}`, err);
            this.close(key);
            return null;
        }
        if (entry.layer === 'popup') audio.duck(260);
        return view;
    }

    close(key: string): void {
        this._requests.delete(key);
        for (let i = this._open.length - 1; i >= 0; i--) {
            const item = this._open[i];
            if (item.key !== key) continue;
            this._open.splice(i, 1);
            try {
                item.view.onClose();
            } catch (err) {
                Logger.warn('UIManager', `onClose 失败：${key}`, err);
            }
            item.view.node.active = false;
            if (item.entry.cache) this._cached.set(key, item.view);
            else item.view.node.destroy();
            if (item.layer === 'popup') audio.unduck();
            return;
        }
    }

    private _cancelPending(layer: UILayer): void {
        for (const key of this._requests.keys()) if (PREFAB_MAP[key].layer === layer) this._requests.delete(key);
    }

    closeLayer(layer: UILayer): void {
        this._cancelPending(layer);
        const list = this._open.filter((o) => o.layer === layer);
        for (const item of list) this.close(item.key);
    }

    closeTop(layer: UILayer = 'popup'): void {
        this._cancelPending(layer);
        for (let i = this._open.length - 1; i >= 0; i--) {
            if (this._open[i].layer === layer) {
                this.close(this._open[i].key);
                return;
            }
        }
    }

    closeAll(): void {
        this._requests.clear();
        const list = this._open.slice().reverse();
        for (const item of list) this.close(item.key);
    }

    /** 轻提示：复用 Toast Prefab */
    async toast(text: string): Promise<void> {
        const view = await this.open('toast');
        const anyView = view as unknown as { show?: (t: string) => void };
        anyView?.show?.(text);
    }

    get openCount(): number {
        return this._open.length;
    }

    debugStack(): string[] {
        return this._open.map((o) => `${o.layer}:${o.key}`);
    }
}
