/** 格底（Prefab）：只负责尺寸与染色。 */
import { _decorator, Sprite } from 'cc';
import { UIView } from '../ui/UIView';

const { ccclass, property } = _decorator;

@ccclass('GridCellView')
export class GridCellView extends UIView {
    @property(Sprite) bg: Sprite | null = null;
}
