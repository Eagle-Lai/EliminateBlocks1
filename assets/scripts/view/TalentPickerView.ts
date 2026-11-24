/** 三选一：Mask / Title / Cards / Btn_Skip；卡片错峰 60ms 入场。 */
import { _decorator, Label, Node, Prefab, UIOpacity, Vec3, instantiate, tween } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { TalentCardView } from './TalentCardView';
import { setLabel } from './ViewUtils';
import { assets } from '../service/AssetService';
import type { TalentDef } from '../config/TalentTable';
import { TALENT_SKIP_COINS } from '../core/TalentPool';
import { TUNING } from '../config/GameTuning';

const { ccclass, property } = _decorator;

@ccclass('TalentPickerView')
export class TalentPickerView extends UIView {
    @property(Node) cardsRoot: Node | null = null;
    @property(Prefab) cardPrefab: Prefab | null = null;
    @property(Label) titleLabel: Label | null = null;
    @property(UIButton) skipBtn: UIButton | null = null;

    private _cards: TalentCardView[] = [];
    private _resolve: ((id: number | null) => void) | null = null;

    onOpen(): void {
        this.assertRefs([
            ['cardsRoot', this.cardsRoot],
            ['skipBtn', this.skipBtn],
        ]);
        if (this.skipBtn) this.skipBtn.onClick = () => this._finish(null);
    }

    /** 展示三张；返回选中的 id（null = 跳过） */
    play(offers: readonly TalentDef[]): Promise<number | null> {
        setLabel(this.titleLabel, '选择一项天赋');
        if (this.skipBtn) this.skipBtn.setText(`跳过 +${TALENT_SKIP_COINS}`);
        for (const card of this._cards) card.node.destroy();
        this._cards = [];
        const prefab = this.cardPrefab ?? assets.getPrefab('prefabs/ui/TalentCard');
        if (this.cardsRoot && prefab) {
            offers.forEach((def, i) => {
                const node = instantiate(prefab);
                node.setParent(this.cardsRoot);
                const card = node.getComponent(TalentCardView);
                if (!card) return;
                card.onOpen();
                card.setTalent(def);
                card.bind(() => this._finish(def.id));
                this._cards.push(card);
                const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
                op.opacity = 0;
                node.setScale(0.85, 0.85, 1);
                tween(op)
                    .delay(i * (TUNING.talents.cardStaggerMs / 1000))
                    .to(0.14, { opacity: 255 })
                    .start();
                tween(node)
                    .delay(i * (TUNING.talents.cardStaggerMs / 1000))
                    .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                    .start();
            });
        }
        return new Promise((resolve) => {
            this._resolve = resolve;
        });
    }

    private _finish(id: number | null): void {
        const resolve = this._resolve;
        this._resolve = null;
        resolve?.(id);
    }

    onClose(): void {
        this._finish(null);
    }
}
