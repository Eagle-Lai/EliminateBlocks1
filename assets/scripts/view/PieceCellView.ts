/** 骨牌格（Prefab）：Base + Highlight。 */
import { _decorator, Sprite } from 'cc';
import { UIView } from '../ui/UIView';

const { ccclass, property } = _decorator;

@ccclass('PieceCellView')
export class PieceCellView extends UIView {
    @property(Sprite) base: Sprite | null = null;
    @property(Sprite) highlight: Sprite | null = null;
}
