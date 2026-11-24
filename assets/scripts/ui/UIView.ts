/**
 * 视图基类：只做 Prefab 绑定、显隐、数据填充；不创建节点。
 * 子类用 @property 绑定子节点，在 onOpen 里调 assertRefs。
 */
import { _decorator, Component, Widget } from 'cc';
import { Logger } from '../utils/Logger';
import type { UILayer } from '../config/UIPrefabs';

const { ccclass } = _decorator;

@ccclass('UIView')
export class UIView extends Component {
    /** 由 UIManager 注入，避免循环依赖 */
    static host: { close(key: string): void } | null = null;

    /** 由 UIManager 注入 */
    key = '';
    layer: UILayer = 'panel';

    onOpen(_data?: unknown): void {
        /* 子类覆写 */
    }

    onClose(): void {
        /* 子类覆写 */
    }

    close(): void {
        UIView.host?.close(this.key);
    }

    /** debug 下缺引用立即抛错并打印 Prefab 路径，避免上线后静默空白 */
    assertRefs(refs: ReadonlyArray<readonly [string, unknown]>): void {
        const missing: string[] = [];
        for (const [name, value] of refs) {
            if (value === null || value === undefined) missing.push(name);
        }
        if (missing.length > 0) {
            const msg = `[${this.key || this.node.name}] 缺少 Prefab 绑定：${missing.join(', ')}`;
            Logger.error('UIView', msg);
            throw new Error(msg);
        }
    }

    /** 安全区：只改 Widget 偏移，不在代码里 setPosition */
    applySafeArea(top: number, bottom: number): void {
        const widget = this.getComponent(Widget);
        if (!widget) return;
        widget.top = top;
        widget.bottom = bottom;
        widget.updateAlignment();
    }
}
