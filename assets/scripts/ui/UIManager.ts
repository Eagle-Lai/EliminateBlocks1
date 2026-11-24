/**
 * UI 管理器：层栈、Prefab 加载/实例化、open/close/closeTop/closeAll、toast。
 * 只操作 Prefab 实例，不拼界面。Panel 最多 1 个、Popup 最多 1 个、Toast ≤2。
 */
import { _decorator, Component, Node, Prefab, UITransform, instantiate } from 'cc';
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
    private _loading = new Map<string, Promise<UIView | null>>();

    onLoad(): void {
        UIManager.instance = this;
        UIView.host = this;
        if (!this.layerScene || !this.layerPanel || !this.layerPopup || !this.layerToast) {
            Logger.error('UIManager', 'UIRoot 四层未绑定');
        }
    }

    onDestroy(): void {
        if (UIManager.instance === this) UIManager.instance = null;
        if (UIView.host === this) UIView.host = null;
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
        const existing = this.get<T>(key);
        if (existing) {
            existing.node.active = true;
            existing.onOpen(data);
            return existing;
        }
        const pending = this._loading.get(key);
        if (pending) return (await pending) as T | null;

        const task = this._createView(key, entry, data);
        this._loading.set(key, task);
        try {
            return (await task) as T | null;
        } finally {
            this._loading.delete(key);
        }
    }

    private async _createView(key: string, entry: (typeof PREFAB_MAP)[string], data?: unknown): Promise<UIView | null> {
        const prefab: Prefab | null = await assets.loadPrefab(entry.path);
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
        if (entry.layer === 'panel') this.closeLayer('panel');
        if (entry.layer === 'popup') this.closeLayer('popup');
        if (entry.layer === 'toast') {
            const toasts = this._open.filter((o) => o.layer === 'toast');
            while (toasts.length >= 2) {
                const oldest = toasts.shift();
                if (oldest) this.close(oldest.key);
            }
        }

        const node = instantiate(prefab);
        node.setParent(layerNode);
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
        for (let i = this._open.length - 1; i >= 0; i--) {
            const item = this._open[i];
            if (item.key !== key) continue;
            this._open.splice(i, 1);
            try {
                item.view.onClose();
            } catch (err) {
                Logger.warn('UIManager', `onClose 失败：${key}`, err);
            }
            if (item.entry.cache) item.view.node.active = false;
            else item.view.node.destroy();
            return;
        }
    }

    closeLayer(layer: UILayer): void {
        const list = this._open.filter((o) => o.layer === layer);
        for (const item of list) this.close(item.key);
    }

    closeTop(layer: UILayer = 'popup'): void {
        for (let i = this._open.length - 1; i >= 0; i--) {
            if (this._open[i].layer === layer) {
                this.close(this._open[i].key);
                return;
            }
        }
    }

    closeAll(): void {
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
