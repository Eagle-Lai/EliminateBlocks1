/** 糖晶工坊开场。插画按屏幕比例铺满，标题和进度留在插画的上下暗区。 */
import { _decorator, Label, Node, Sprite, view } from 'cc';
import { UIView } from '../ui/UIView';
import { ProgressBarView } from './ProgressBarView';
import { platform } from '../service/PlatformAdapter';
import { setLabel, setSize } from './ViewUtils';

const { ccclass, property } = _decorator;

@ccclass('BootView')
export class BootView extends UIView {
    @property(Sprite) backdrop: Sprite | null = null;
    @property(Sprite) logo: Sprite | null = null;
    @property(Node) title: Node | null = null;
    @property(Node) rule: Node | null = null;
    @property(ProgressBarView) bar: ProgressBarView | null = null;
    @property(Label) versionLabel: Label | null = null;
    @property(Label) tipLabel: Label | null = null;

    onEnable(): void {
        view.on('canvas-resize', this.fitScreen, this);
    }

    onDisable(): void {
        view.off('canvas-resize', this.fitScreen, this);
    }

    onOpen(data?: unknown): void {
        this.assertRefs([['bar', this.bar], ['backdrop', this.backdrop], ['title', this.title]]);
        this.fitScreen();
        setLabel(this.versionLabel, typeof data === 'string' ? data : '版本 2.0.0');
        this.bar?.onOpen();
        this.setProgress(0, '准备糖块与音效…');
    }

    private fitScreen(): void {
        const { width, height } = view.getVisibleSize();
        const art = this.backdrop?.spriteFrame?.originalSize;
        if (art && art.width && art.height) {
            const cover = Math.max(width / art.width, height / art.height);
            setSize(this.backdrop!.node, art.width * cover, art.height * cover);
        }
        const inset = platform.getSafeInsets(width);
        const titleY = Math.min(height * 0.34, height / 2 - inset.top - 160);
        this.logo?.node.setPosition(0, titleY + 90, 0);
        this.title?.setPosition(0, titleY, 0);
        this.rule?.setPosition(0, titleY - 72, 0);

        const bottom = -height / 2 + inset.bottom;
        const barY = bottom + Math.max(118, height * 0.1);
        this.bar?.node.setPosition(0, barY, 0);
        this.tipLabel?.node.setPosition(-44, barY + 43, 0);
        this.versionLabel?.node.setPosition(0, bottom + 38, 0);
    }

    setProgress(p: number, tip?: string): void {
        this.bar?.setProgress(p, `${Math.round(p * 100)}%`);
        if (tip) setLabel(this.tipLabel, tip);
    }
}
