/** 异变开场：Card / Icon / Name / Rule / Btn_Skip（1.4s 可跳过）。 */
import { _decorator, Label, Sprite, UIOpacity, Vec3, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { mutationById, type MutationTier } from '../config/MutationTable';
import { assets } from '../service/AssetService';
import { ART } from '../config/AssetKeys';
import { setLabel } from './ViewUtils';
import { TUNING } from '../config/GameTuning';

const { ccclass, property } = _decorator;

const TIER_NAME: Record<MutationTier, string> = { light: '轻', standard: '标准', strong: '强' };

@ccclass('MutationIntroView')
export class MutationIntroView extends UIView {
    @property(Sprite) icon: Sprite | null = null;
    @property(Label) nameLabel: Label | null = null;
    @property(Label) ruleLabel: Label | null = null;
    @property(Label) tierLabel: Label | null = null;
    @property(UIButton) skipBtn: UIButton | null = null;

    private _resolve: (() => void) | null = null;
    private _done = false;

    onOpen(): void {
        this.assertRefs([
            ['icon', this.icon],
            ['nameLabel', this.nameLabel],
            ['skipBtn', this.skipBtn],
        ]);
        if (this.skipBtn) this.skipBtn.onClick = () => this.dismiss();
    }

    /** 展示 1.4s（可点跳过）；返回 Promise 供 lock 流程 await */
    play(mutationId: number, tier: MutationTier): Promise<void> {
        const def = mutationById(mutationId);
        this._done = false;
        if (def) {
            setLabel(this.nameLabel, def.name);
            setLabel(this.ruleLabel, def.desc);
            setLabel(this.tierLabel, `${TIER_NAME[tier]}档`);
            assets.loadSpriteFrame(ART.icon(def.icon)).then((sf) => {
                if (this.icon && this.icon.isValid) this.icon.spriteFrame = sf;
            });
        }
        this.node.active = true;
        const card = this.node.getChildByName('Card');
        if (card) {
            const op = card.getComponent(UIOpacity) || card.addComponent(UIOpacity);
            op.opacity = 0;
            card.setScale(0.9, 0.9, 1);
            tween(op).to(0.16, { opacity: 255 }).start();
            tween(card).to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }

        return new Promise<void>((resolve) => {
            this._resolve = resolve;
            this.scheduleOnce(() => this.dismiss(), TUNING.mutations.introMs / 1000);
        });
    }

    dismiss(): void {
        if (this._done) return;
        this._done = true;
        this.node.active = false;
        const resolve = this._resolve;
        this._resolve = null;
        resolve?.();
    }
}
