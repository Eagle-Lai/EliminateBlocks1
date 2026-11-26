/** 通用弹窗：遮罩 + 卡片 + 标签/标题/分数/星级/副标题 + 主次按钮（Prefab 静态，不动态建按钮）。 */
import { _decorator, Label, Node, ParticleSystem2D, Tween, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { StarRowView } from './StarRowView';
import { setActive, setLabel, setPos, setSize } from './ViewUtils';
import { scatter } from './UIMotion';
import { playClip } from '../utils/Anim';

const { ccclass, property } = _decorator;

export interface DialogButton {
    text: string;
    onClick: () => void;
    kind?: 'primary' | 'secondary';
}

export interface DialogOptions {
    onReplay?: () => void;
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
    @property(Node) header: Node | null = null;
    @property(Node) rewardSparks: Node | null = null;
    @property(Node) quietOrbit: Node | null = null;
    @property(Node) victoryRays: Node | null = null;
    @property(Node) fountains: Node | null = null;
    @property(Label) tagLabel: Label | null = null;
    @property(Label) titleLabel: Label | null = null;
    @property(Label) scoreLabel: Label | null = null;
    @property(Label) subtitleLabel: Label | null = null;
    @property(StarRowView) starRow: StarRowView | null = null;
    @property(UIButton) primaryBtn: UIButton | null = null;
    @property(UIButton) secondaryBtn: UIButton | null = null;

    private _openedAt = 0;
    private _replay: (() => void) | null = null;
    private _counter = { value: 0 };

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
        const compact = opts.score === undefined && opts.stars === undefined;
        setSize(this.card, 600, compact ? 460 : 640);
        setPos(this.header, 0, compact ? 151 : 224);
        setPos(this.titleLabel?.node ?? null, 0, (compact ? 151 : 224) - (opts.tag ? 16 : 0));
        setPos(this.tagLabel?.node ?? null, 0, (compact ? 151 : 224) + 31);
        setPos(this.subtitleLabel?.node ?? null, 0, compact ? 46 : 35);
        setPos(this.primaryBtn?.node ?? null, 0, compact ? -48 : -134);
        setPos(this.secondaryBtn?.node ?? null, 0, compact ? -141 : -230);
        setLabel(this.tagLabel, opts.tag ?? '');
        setActive(this.tagLabel?.node ?? null, !!opts.tag);
        setLabel(this.titleLabel, opts.title);
        setLabel(this.scoreLabel, opts.score ?? '');
        Tween.stopAllByTarget(this._counter);
        if (opts.score && /^\d+$/.test(opts.score) && Number(opts.score) > 0) {
            this._counter.value = 0;
            setLabel(this.scoreLabel, '0');
            tween(this._counter).to(0.55, { value: Number(opts.score) }, {
                easing: 'quadOut',
                onUpdate: () => setLabel(this.scoreLabel, String(Math.round(this._counter.value))),
            }).start();
        }
        setActive(this.scoreLabel?.node ?? null, !!opts.score);
        if (this._replay) this.scoreLabel?.node.off(Node.EventType.TOUCH_END, this._replay, this);
        this._replay = opts.onReplay ?? null;
        if (this._replay) this.scoreLabel?.node.on(Node.EventType.TOUCH_END, this._replay, this);
        const subtitle = [opts.subtitle, this._replay ? '点分数看最佳回放' : ''].filter(Boolean).join(' · ');
        setLabel(this.subtitleLabel, subtitle);
        setActive(this.subtitleLabel?.node ?? null, !!subtitle);
        setActive(this.starRow?.node ?? null, opts.stars !== undefined);
        if (opts.stars !== undefined) this.starRow?.setStars(opts.stars);
        const won = (opts.stars ?? 0) > 0;
        setActive(this.quietOrbit, !won);
        setActive(this.victoryRays, won);
        setActive(this.fountains, won);
        if (won) this.fountains?.getComponentsInChildren(ParticleSystem2D).forEach(emitter => emitter.resetSystem());
        setActive(this.rewardSparks, won);
        if (this.rewardSparks?.active) scatter(this.rewardSparks, 230, 82, 0.25);

        const primary = opts.buttons[0] ?? null;
        const secondary = opts.buttons[1] ?? null;
        this._bind(this.primaryBtn, primary, 'primary');
        this._bind(this.secondaryBtn, secondary, 'secondary');

        if (this.card) {
            const op = this.card.getComponent(UIOpacity) || this.card.addComponent(UIOpacity);
            Tween.stopAllByTarget(op);
            Tween.stopAllByTarget(this.card);
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

    onDisable(): void {
        Tween.stopAllByTarget(this._counter);
    }

    onClose(): void {
        this.node.active = false;
    }
}
