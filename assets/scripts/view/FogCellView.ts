/** 迷雾格（Prefab）：Fog + ShapeMark。 */
import { _decorator, Sprite } from 'cc';
import { UIView } from '../ui/UIView';

const { ccclass, property } = _decorator;

@ccclass('FogCellView')
export class FogCellView extends UIView {
    @property(Sprite) fog: Sprite | null = null;
    @property(Sprite) shapeMark: Sprite | null = null;
}
