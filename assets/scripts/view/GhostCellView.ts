/** 落点虚影（Prefab）：Fill + GoldBorder。 */
import { _decorator, Sprite } from 'cc';
import { UIView } from '../ui/UIView';

const { ccclass, property } = _decorator;

@ccclass('GhostCellView')
export class GhostCellView extends UIView {
    @property(Sprite) fill: Sprite | null = null;
    @property(Sprite) goldBorder: Sprite | null = null;
}
