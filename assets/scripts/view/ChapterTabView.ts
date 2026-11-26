/** 章节页签：Icon / Name / Stars / Lock。 */
import { _decorator, Label, Node, Sprite } from 'cc';
import { UIView } from '../ui/UIView';
import { UIButton } from '../ui/UIButton';
import { setActive, setLabel } from './ViewUtils';
import { assets } from '../service/AssetService';
import { ART } from '../config/AssetKeys';

const { ccclass, property } = _decorator;

@ccclass('ChapterTabView')
export class ChapterTabView extends UIView {
    @property(Node) selection: Node | null = null;
    @property(Sprite) icon: Sprite | null = null;
    @property(Label) nameLabel: Label | null = null;
    @property(Label) starsLabel: Label | null = null;
    @property(Node) lock: Node | null = null;
    @property(UIButton) button: UIButton | null = null;

    onOpen(): void {
        this.assertRefs([['nameLabel', this.nameLabel], ['button', this.button]]);
    }

    setChapter(index: number, name: string, stars: number, unlocked: boolean, selected: boolean): void {
        setLabel(this.nameLabel, name);
        setLabel(this.starsLabel, `${stars}/60 ★`);
        setActive(this.lock, !unlocked);
        setActive(this.selection, selected);
        this.button?.setInteractable(unlocked);
        assets.loadSpriteFrame(ART.icon(`chapter_${index}`)).then((sf) => {
            if (this.icon && this.icon.isValid) this.icon.spriteFrame = sf;
        });
    }

    bind(onClick: () => void): void {
        if (this.button) this.button.onClick = onClick;
    }
}
