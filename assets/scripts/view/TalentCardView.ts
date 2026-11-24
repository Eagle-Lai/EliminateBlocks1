/** 天赋卡：RarityFrame / Category / Name / Effect / Icon。 */
import { _decorator, Label, Node, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { setLabel, setActive } from './ViewUtils';
import type { TalentDef } from '../config/TalentTable';
import { assets } from '../service/AssetService';
import { ART } from '../config/AssetKeys';

const { ccclass, property } = _decorator;

@ccclass('TalentCardView')
export class TalentCardView extends UIView {
    @property(Sprite) rarityFrame: Sprite | null = null;
    @property(Sprite) icon: Sprite | null = null;
    @property(Sprite) categoryIcon: Sprite | null = null;
    @property(Label) nameLabel: Label | null = null;
    @property(Label) effectLabel: Label | null = null;
    @property(Label) rarityLabel: Label | null = null;
    @property(UIButton) button: UIButton | null = null;

    onOpen(): void {
        this.assertRefs([['nameLabel', this.nameLabel], ['button', this.button]]);
    }

    setTalent(def: TalentDef): void {
        setLabel(this.nameLabel, def.name);
        setLabel(this.effectLabel, def.desc);
        setLabel(this.rarityLabel, def.rarity === 'legendary' ? '传说' : def.rarity === 'rare' ? '稀有' : '普通');
        setActive(this.categoryIcon?.node ?? null, true);
        assets.loadSpriteFrame(ART.icon(def.icon)).then((sf) => {
            if (this.icon && this.icon.isValid) this.icon.spriteFrame = sf;
            if (this.categoryIcon && this.categoryIcon.isValid) this.categoryIcon.spriteFrame = sf;
        });
        if (this.rarityFrame) {
            this.rarityFrame.spriteFrame = assets.getFrame(ART.ui.frameGold);
            this.rarityFrame.node.active = def.rarity !== 'common';
        }
    }

    bind(onClick: () => void): void {
        if (this.button) this.button.onClick = onClick;
    }
}
