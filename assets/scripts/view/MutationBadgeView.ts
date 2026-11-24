/** 异变角标：Icon / Name / Countdown。 */
import { _decorator, Label, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { setLabel } from './ViewUtils';
import { mutationById } from '../config/MutationTable';
import { assets } from '../service/AssetService';
import { ART } from '../config/AssetKeys';

const { ccclass, property } = _decorator;

@ccclass('MutationBadgeView')
export class MutationBadgeView extends UIView {
    @property(Sprite) icon: Sprite | null = null;
    @property(Label) nameLabel: Label | null = null;
    @property(Label) countdownLabel: Label | null = null;

    onOpen(): void {
        this.assertRefs([
            ['icon', this.icon],
            ['nameLabel', this.nameLabel],
        ]);
    }

    setMutation(id: number, every: number, locks: number): void {
        const def = mutationById(id);
        if (!def) return;
        setLabel(this.nameLabel, def.name);
        assets.loadSpriteFrame(ART.icon(def.icon)).then((sf) => {
            if (this.icon && this.icon.isValid) this.icon.spriteFrame = sf;
        });
        this.setCountdown(every, locks);
    }

    setCountdown(every: number, locks: number): void {
        if (!this.countdownLabel) return;
        if (every <= 0) {
            this.countdownLabel.string = '常驻';
            return;
        }
        const left = every - (locks % every);
        this.countdownLabel.string = `还有 ${left}`;
    }
}
