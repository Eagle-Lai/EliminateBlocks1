/** 通用弹窗：遮罩 + 卡片 + 标签/标题/分数/星级/副标题 + 主次按钮（Prefab 静态，不动态建按钮）。 */
import { _decorator, Label, Node, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { StarRowView } from './StarRowView';
import { setActive, setLabel } from './ViewUtils';
import { playClip } from '../utils/Anim';

const { ccclass, property } = _decorator;

export interface DialogButton {
    text: string;
    onClick: () => void;
    kind?: 'primary' | 'secondary';
}

export interface DialogOptions {
    tag?: string;
    title: string;
    score?: string;
    subtitle?: string;
    stars?: number;
    buttons: DialogButton[];
}

@ccclass('DialogView')
export class DialogView extends UIView {
    @property(Node) mask: Node | null = null;
    @property(Node) card: Node | null = null;
    @property(Label) tagLabel: Label | null = null;
    @property(Label) titleLabel: Label | null = null;
    @property(Label) scoreLabel: Label | null = null;
    @property(Label) subtitleLabel: Label | null = null;
    @property(StarRowView) starRow: StarRowView | null = null;
    @property(UIButton) primaryBtn: UIButton | null = null;
    @property(UIButton) secondaryBtn: UIButton | null = null;

    private _openedAt = 0;

    onOpen(): void {
        this.assertRefs([
            ['card', this.card],
            ['titleLabel', this.titleLabel],
            ['primaryBtn', this.primaryBtn],
        ]);
        this.node.active = true;
    }

    show(opts: DialogOptions): void {
        this.node.active = true;
        this._openedAt = Date.now();
        setLabel(this.tagLabel, opts.tag ?? '');
        setActive(this.tagLabel?.node ?? null, !!opts.tag);
        setLabel(this.titleLabel, opts.title);
        setLabel(this.scoreLabel, opts.score ?? '');
        setActive(this.scoreLabel?.node ?? null, !!opts.score);
        setLabel(this.subtitleLabel, opts.subtitle ?? '');
        setActive(this.subtitleLabel?.node ?? null, !!opts.subtitle);
        setActive(this.starRow?.node ?? null, opts.stars !== undefined);
        if (opts.stars !== undefined) this.starRow?.setStars(opts.stars);

        const primary = opts.buttons[0] ?? null;
        const secondary = opts.buttons[1] ?? null;
        this._bind(this.primaryBtn, primary, 'primary');
        this._bind(this.secondaryBtn, secondary, 'secondary');

        if (this.card) {
            const op = this.card.getComponent(UIOpacity) || this.card.addComponent(UIOpacity);
            op.opacity = 0;
            tween(op).to(0.16, { opacity: 255 }).start();
            playClip(this.card, 'dialog-in', () => {
                this.card!.setScale(0.88, 0.88, 1);
                tween(this.card!).to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            });
        }
        if (this.mask) {
            const mop = this.mask.getComponent(UIOpacity) || this.mask.addComponent(UIOpacity);
            mop.opacity = 0;
            tween(mop).to(0.2, { opacity: 255 }).start();
        }
    }

    private _bind(btn: UIButton | null, data: DialogButton | null, kind: 'primary' | 'secondary'): void {
        if (!btn) return;
        setActive(btn.node, !!data);
        if (!data) return;
        btn.setKind(data.kind ?? kind);
        btn.setText(data.text);
        btn.setInteractable(true);
        btn.onClick = () => {
            if (Date.now() - this._openedAt < 260) return;
            btn.node.active = false;
            data.onClick();
        };
    }

    hide(): void {
        this.node.active = false;
    }

    onClose(): void {
        this.node.active = false;
    }
}
