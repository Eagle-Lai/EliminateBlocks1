/** 关卡格：Index / Name / Stars / Lock / MutationIcon。 */
import { _decorator, Label, Node, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { setActive, setLabel } from './ViewUtils';
import { mutationById } from '../config/MutationTable';
import { assets } from '../service/AssetService';
import { ART } from '../config/AssetKeys';

const { ccclass, property } = _decorator;

@ccclass('LevelNodeView')
export class LevelNodeView extends UIView {
    @property(Label) indexLabel: Label | null = null;
    @property(Label) nameLabel: Label | null = null;
    @property(Label) starsLabel: Label | null = null;
    @property(Node) lock: Node | null = null;
    @property(Sprite) mutationIcon: Sprite | null = null;
    @property(UIButton) button: UIButton | null = null;

    onOpen(): void {
        this.assertRefs([['indexLabel', this.indexLabel], ['button', this.button]]);
    }

    setLevel(id: number, name: string, stars: number, unlocked: boolean, mutationId: number): void {
        setLabel(this.indexLabel, String(id));
        setLabel(this.nameLabel, name);
        setLabel(this.starsLabel, stars > 0 ? '★'.repeat(stars) : '');
        setActive(this.lock, !unlocked);
        const def = mutationById(mutationId);
        setActive(this.mutationIcon?.node ?? null, !!def);
        if (def) {
            assets.loadSpriteFrame(ART.icon(def.icon)).then((sf) => {
                if (this.mutationIcon && this.mutationIcon.isValid) this.mutationIcon.spriteFrame = sf;
            });
        }
    }

    bind(onClick: () => void): void {
        if (this.button) this.button.onClick = onClick;
    }
}
