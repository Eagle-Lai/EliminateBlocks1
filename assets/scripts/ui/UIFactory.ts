/**
 * UI 构建工具：统一节点、圆角面板、文字、九宫格的创建方式。
 * 所有尺寸使用设计分辨率单位（750×1334 基线），坐标以父节点中心为原点。
 */
import {
    Color,
    Graphics,
    Label,
    LabelOutline,
    Layers,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
    UIOpacity,
    Vec3,
} from 'cc';
import { THEME } from '../config/ThemeConfig';

export function createNode(name: string, parent?: Node): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform);
    if (parent) node.setParent(parent);
    return node;
}

export function setSize(node: Node, w: number, h: number): UITransform {
    const ui = node.getComponent(UITransform) || node.addComponent(UITransform);
    ui.setContentSize(w, h);
    return ui;
}

export function setPos(node: Node, x: number, y: number): void {
    node.setPosition(x, y, 0);
}

/** 在节点本地坐标系里画一个圆角矩形（节点锚点默认 0.5） */
export function drawRoundRect(
    g: Graphics,
    w: number,
    h: number,
    radius: number,
    fill: Color,
    stroke?: Color,
    strokeWidth = 0,
): void {
    g.fillColor = fill;
    g.roundRect(-w / 2, -h / 2, w, h, radius);
    g.fill();
    if (stroke && strokeWidth > 0) {
        g.lineWidth = strokeWidth;
        g.strokeColor = stroke;
        g.roundRect(-w / 2, -h / 2, w, h, radius);
        g.stroke();
    }
}

export interface PanelOptions {
    radius?: number;
    fill?: Color;
    stroke?: Color;
    strokeWidth?: number;
    /** 底部柔和投影的偏移，0 表示不加 */
    shadowOffset?: number;
}

/** 卡片/面板：一层阴影 + 一层底 */
export function createPanel(parent: Node, w: number, h: number, opts: PanelOptions = {}): Node {
    const radius = opts.radius ?? 24;
    const fill = opts.fill ?? THEME.card;
    const stroke = opts.stroke ?? THEME.cardBorder;
    const node = createNode('Panel', parent);
    setSize(node, w, h);

    if (opts.shadowOffset && opts.shadowOffset > 0) {
        const shadowNode = createNode('Shadow', node);
        setSize(shadowNode, w, h);
        shadowNode.setPosition(0, -opts.shadowOffset, 0);
        const sg = shadowNode.addComponent(Graphics);
        drawRoundRect(sg, w, h, radius, new Color(90, 60, 30, 26));
    }

    const g = node.addComponent(Graphics);
    drawRoundRect(g, w, h, radius, fill, stroke, 2);
    return node;
}

export interface LabelOptions {
    size?: number;
    color?: Color;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: number;
    height?: number;
    lineHeight?: number;
    outline?: Color;
    outlineWidth?: number;
    wrap?: boolean;
}

export function createLabel(parent: Node, text: string, opts: LabelOptions = {}): Label {
    const node = createNode('Label', parent);
    const fontSize = opts.size ?? 22;
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = opts.lineHeight ?? Math.round(fontSize * 1.25);
    label.color = opts.color ?? THEME.textPrimary;
    label.isBold = opts.bold ?? false;
    label.horizontalAlign =
        opts.align === 'left'
            ? Label.HorizontalAlign.LEFT
            : opts.align === 'right'
              ? Label.HorizontalAlign.RIGHT
              : Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = opts.wrap ? Label.Overflow.RESIZE_HEIGHT : Label.Overflow.NONE;

    const w = opts.width ?? 400;
    const h = opts.height ?? label.lineHeight;
    setSize(node, w, h);
    if (opts.align === 'left') {
        node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
    } else if (opts.align === 'right') {
        node.getComponent(UITransform)!.setAnchorPoint(1, 0.5);
    }

    if (opts.outline) {
        const outline = node.addComponent(LabelOutline);
        outline.color = opts.outline;
        outline.width = opts.outlineWidth ?? 3;
    }
    return label;
}

export function createSprite(parent: Node, frame: SpriteFrame | null, w: number, h: number): Sprite {
    const node = createNode('Sprite', parent);
    setSize(node, w, h);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.type = Sprite.Type.SIMPLE;
    sprite.spriteFrame = frame;
    return sprite;
}

export function setOpacity(node: Node, value: number): UIOpacity {
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    op.opacity = value;
    return op;
}

export function getOpacity(node: Node): UIOpacity {
    return node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
}

export const COLORS = {
    white: new Color(255, 255, 255, 255),
    transparent: new Color(255, 255, 255, 0),
};

export function v3(x: number, y: number): Vec3 {
    return new Vec3(x, y, 0);
}
