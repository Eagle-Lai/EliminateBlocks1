/** 视图工具：只做属性赋值与尺寸设置，不创建节点。 */
import { Label, Node, Sprite, SpriteFrame, UITransform, UIOpacity } from 'cc';
import { assets } from '../service/AssetService';

export function setLabel(label: Label | null, text: string): void {
    if (label && label.string !== text) label.string = text;
}

export function setSprite(sprite: Sprite | null, frame: SpriteFrame | null): void {
    if (sprite && sprite.spriteFrame !== frame) sprite.spriteFrame = frame;
}

export function loadSprite(sprite: Sprite | null, path: string | null): void {
    if (!sprite || !path) return;
    assets.loadSpriteFrame(path).then((sf) => {
        if (sf && sprite.isValid) sprite.spriteFrame = sf;
    });
}

export function setSize(node: Node | null, w: number, h: number): void {
    if (!node) return;
    const ut = node.getComponent(UITransform);
    if (ut) ut.setContentSize(w, h);
}

export function setPos(node: Node | null, x: number, y: number): void {
    if (node) node.setPosition(x, y, 0);
}

export function setActive(node: Node | null, active: boolean): void {
    if (node && node.active !== active) node.active = active;
}

export function setOpacity(target: Node | UIOpacity | null, value: number): void {
    if (!target) return;
    const op = target instanceof Node ? target.getComponent(UIOpacity) : target;
    if (op) op.opacity = value;
}

export function fmt(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}
