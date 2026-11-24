/* eslint-disable */
// 在 Cocos 编辑器「场景进程」里执行：程序化搭建 38 个 Prefab 的节点树，返回 root uuid。
// 由 scripts/prefabs/run.cjs 通过 MCP scene_script 注入，args.frames 是 图片路径 → spriteFrame uuid 映射。
const W = 750;
const H = 1334;
const UI_LAYER = 1 << 25;
const F = args.frames || {};
const FONT_UUID = args.fontUuid || null;
const loaded = new Map();
let FONT = null;
const ANIM_UUIDS = args.anims || {};
const CLIPS = {};

async function sf(path) {
  if (!path) return null;
  if (loaded.has(path)) return loaded.get(path);
  const uuid = F[path];
  if (!uuid) {
    loaded.set(path, null);
    return null;
  }
  const asset = await new Promise((resolve) => {
    cc.assetManager.loadAny({ uuid }, (err, a) => resolve(err ? null : a));
  });
  loaded.set(path, asset);
  return asset;
}

function node(name, parent, w, h, x, y) {
  const n = new cc.Node(name);
  n.layer = UI_LAYER;
  const ui = n.addComponent(cc.UITransform);
  ui.setContentSize(w || 0, h || 0);
  if (parent) n.setParent(parent);
  n.setPosition(x || 0, y || 0, 0);
  return n;
}

function setSize(n, w, h) {
  const ui = n.getComponent(cc.UITransform);
  if (ui) ui.setContentSize(w, h);
}

async function sprite(n, path, opts) {
  const o = opts || {};
  const s = n.addComponent(cc.Sprite);
  s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  s.type = o.sliced === false ? cc.Sprite.Type.SIMPLE : cc.Sprite.Type.SLICED;
  const frame = await sf(path);
  if (frame) s.spriteFrame = frame;
  if (o.color) s.color = new cc.Color(o.color[0], o.color[1], o.color[2], o.color[3] === undefined ? 255 : o.color[3]);
  if (o.filled) {
    s.type = cc.Sprite.Type.FILLED;
    s.fillType = o.vertical ? cc.Sprite.FillType.VERTICAL : cc.Sprite.FillType.HORIZONTAL;
    s.fillStart = 0;
    s.fillRange = o.fillRange === undefined ? 1 : o.fillRange;
  }
  return s;
}

function label(n, text, opts) {
  const o = opts || {};
  const l = n.addComponent(cc.Label);
  l.string = text;
  l.fontSize = o.size || 24;
  l.lineHeight = o.lineHeight || Math.round((o.size || 24) * 1.25);
  if (FONT) {
    l.useSystemFont = false;
    l.font = FONT;
  }
  l.color = new cc.Color(
    o.color ? o.color[0] : 59,
    o.color ? o.color[1] : 42,
    o.color ? o.color[2] : 31,
    o.color && o.color[3] !== undefined ? o.color[3] : 255,
  );
  l.isBold = !!o.bold;
  l.horizontalAlign = o.align === 'left' ? cc.Label.HorizontalAlign.LEFT : o.align === 'right' ? cc.Label.HorizontalAlign.RIGHT : cc.Label.HorizontalAlign.CENTER;
  l.verticalAlign = cc.Label.VerticalAlign.CENTER;
  l.overflow = o.wrap ? cc.Label.Overflow.RESIZE_HEIGHT : cc.Label.Overflow.NONE;
  if (o.native) l.useSystemFont = true;
  return l;
}

function addOpacity(n, v) {
  const op = n.addComponent(cc.UIOpacity);
  op.opacity = v === undefined ? 255 : v;
  return op;
}

function widget(n, opts) {
  const o = opts || {};
  const w = n.addComponent(cc.Widget);
  w.isAlignLeft = o.left !== undefined;
  w.isAlignRight = o.right !== undefined;
  w.isAlignTop = o.top !== undefined;
  w.isAlignBottom = o.bottom !== undefined;
  if (o.left !== undefined) w.left = o.left;
  if (o.right !== undefined) w.right = o.right;
  if (o.top !== undefined) w.top = o.top;
  if (o.bottom !== undefined) w.bottom = o.bottom;
  w.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
  return w;
}

function gridLayout(n, cols, cellW, cellH, gapX, gapY, pad) {
  const l = n.addComponent(cc.Layout);
  l.type = cc.Layout.Type.GRID;
  l.resizeMode = cc.Layout.ResizeMode.NONE;
  l.startAxis = cc.Layout.AxisDirection.HORIZONTAL;
  l.constraint = cc.Layout.Constraint.FIXED_COL;
  l.constraintNum = cols;
  l.cellSize = new cc.Size(cellW, cellH);
  l.spacingX = gapX;
  l.spacingY = gapY === undefined ? gapX : gapY;
  l.paddingLeft = pad || 0;
  l.paddingRight = pad || 0;
  l.paddingTop = pad || 0;
  l.paddingBottom = pad || 0;
  return l;
}

function horizLayout(n, gap) {
  const l = n.addComponent(cc.Layout);
  l.type = cc.Layout.Type.HORIZONTAL;
  l.resizeMode = cc.Layout.ResizeMode.NONE;
  l.spacingX = gap;
  return l;
}

async function panel(parent, name, w, h, x, y, path) {
  const n = node(name, parent, w, h, x, y);
  await sprite(n, path || 'art/ui/panel_card');
  return n;
}

async function button(parent, name, text, kind, w, h, x, y, fontSize) {
  const n = node(name, parent, w, h, x, y);
  const skin = kind === 'primary' ? 'art/ui/btn_primary' : kind === 'icon' ? 'art/ui/btn_icon' : kind === 'ghost' ? 'art/ui/btn_ghost' : 'art/ui/btn_secondary';
  const s = await sprite(n, skin, { sliced: kind !== 'icon' && kind !== 'close' });
  const cls = cc.js.getClassByName('UIButton');
  const b = n.addComponent(cls);
  b.skin = kind || 'secondary';
  b.bg = s;
  if (text) {
    const ln = node('Label', n, w - 8, h);
    const l = label(ln, text, {
      size: fontSize || (kind === 'icon' ? 30 : 28),
      bold: true,
      color: kind === 'primary' ? [255, 252, 245] : [59, 42, 31],
    });
    b.label = l;
  }
  return { node: n, btn: b };
}

function comp(n, className) {
  return n.getComponent(cc.js.getClassByName(className));
}

function attach(n, className, props) {
  const cls = cc.js.getClassByName(className);
  if (!cls) throw new Error('missing class ' + className);
  const c = n.addComponent(cls);
  if (props) for (const k of Object.keys(props)) c[k] = props[k];
  return c;
}

// ───────────────────────── 叶子预制体 ─────────────────────────
async function buildGridCell() {
  const root = node('GridCell', null, 96, 96);
  await sprite(root, 'art/board/cell');
  attach(root, 'GridCellView', { bg: root.getComponent(cc.Sprite) });
  return root;
}

async function buildBlock() {
  const root = node('Block', null, 96, 96);
  const s = await sprite(root, 'art/blocks/block_0');
  const op = addOpacity(root, 255);
  const kind = node('KindOverlay', root, 96, 96);
  await sprite(kind, 'art/blocks/block_stone');
  kind.active = false;
  const special = node('SpecialOverlay', root, 96, 96);
  await sprite(special, 'art/special/stripe_h');
  special.active = false;
  attach(root, 'BlockView', {
    base: s,
    kindOverlay: kind.getComponent(cc.Sprite),
    specialOverlay: special.getComponent(cc.Sprite),
    opacity: op,
  });
  return root;
}

async function buildPieceCell() {
  const root = node('PieceCell', null, 96, 96);
  const s = await sprite(root, 'art/blocks/block_0');
  const hi = node('Highlight', root, 96, 96);
  const hs = await sprite(hi, 'art/blocks/block_0', { color: [255, 255, 255, 90] });
  hi.active = false;
  attach(root, 'PieceCellView', { base: s, highlight: hs });
  return root;
}

async function buildGhostCell() {
  const root = node('GhostCell', null, 96, 96);
  const fill = node('Fill', root, 96, 96);
  await sprite(fill, 'art/board/cell', { color: [78, 203, 138, 70] });
  const gold = node('GoldBorder', root, 96, 96);
  await sprite(gold, 'art/ui/frame_gold', { color: [255, 196, 64, 210] });
  attach(root, 'GhostCellView', { fill: fill.getComponent(cc.Sprite), goldBorder: gold.getComponent(cc.Sprite) });
  return root;
}

async function buildFogCell() {
  const root = node('FogCell', null, 96, 96);
  const fog = node('Fog', root, 96, 96);
  await sprite(fog, 'art/ui/panel_strip', { color: [70, 76, 92, 225] });
  const mark = node('ShapeMark', root, 34, 34);
  await sprite(mark, 'art/blocks/block_0', { color: [255, 255, 255, 120] });
  attach(root, 'FogCellView', { fog: fog.getComponent(cc.Sprite), shapeMark: mark.getComponent(cc.Sprite) });
  return root;
}

async function buildButtonPrefab() {
  const root = node('Button', null, 240, 88);
  const s = await sprite(root, 'art/ui/btn_primary');
  const ln = node('Label', root, 232, 88);
  const l = label(ln, '按钮', { size: 30, bold: true, color: [255, 252, 245] });
  attach(root, 'UIButton', { skin: 'primary', bg: s, label: l });
  return root;
}

async function buildProgressBar() {
  const root = node('ProgressBar', null, 420, 24);
  const track = node('Track', root, 420, 24);
  await sprite(track, 'art/ui/bar_track');
  const fill = node('Fill', root, 420, 24);
  const fs = await sprite(fill, 'art/ui/bar_fill', { filled: true });
  const ln = node('Label', root, 420, 24);
  const l = label(ln, '0%', { size: 18, color: [139, 115, 85] });
  attach(root, 'ProgressBarView', { track: track.getComponent(cc.Sprite), fill: fs, label: l });
  return root;
}

async function buildStarRow() {
  const root = node('StarRow', null, 300, 80);
  const names = ['Star1', 'Star2', 'Star3'];
  const sprites = [];
  for (let i = 0; i < 3; i++) {
    const n = node(names[i], root, 72, 72, -100 + i * 100, 0);
    sprites.push(await sprite(n, 'art/icon/star_empty'));
  }
  addAnim(root, ['star-pop']);
  attach(root, 'StarRowView', { star1: sprites[0], star2: sprites[1], star3: sprites[2] });
  return root;
}

async function buildToast() {
  const root = node('Toast', null, 400, 64);
  const bg = node('Bg', root, 400, 64);
  await sprite(bg, 'art/ui/panel_strip');
  const icon = node('Icon', root, 32, 32, -160, 0);
  await sprite(icon, 'art/icon/icon_coin');
  icon.active = false;
  const t = node('Text', root, 340, 64);
  const l = label(t, '提示', { size: 24, color: [255, 252, 245] });
  addAnim(bg, ['toast-in']);
  attach(root, 'ToastView', { bg, icon: icon.getComponent(cc.Sprite), textLabel: l });
  return root;
}

async function buildBanner() {
  const root = node('Banner', null, 320, 52);
  const p = node('Panel', root, 320, 52);
  const s = await sprite(p, 'art/ui/panel_strip');
  const t = node('Text', p, 300, 52);
  const l = label(t, '连锁 x2', { size: 26, bold: true, color: [255, 209, 102] });
  addAnim(p, ['banner-in']);
  attach(root, 'BannerView', { panel: p, label: l, bg: s });
  return root;
}

async function buildFloatText() {
  const root = node('FloatText', null, 620, 992);
  const slots = node('SlotRoot', root, 620, 992);
  for (let i = 0; i < 8; i++) {
    const n = node('Slot_' + i, slots, 240, 44);
    const l = label(n, '+0', { size: 34, bold: true, color: [255, 255, 255] });
    addOpacity(n, 255);
    n.active = false;
    void l;
  }
  attach(root, 'FloatTextView', { slotRoot: slots });
  return root;
}

async function buildHighlight() {
  const root = node('Highlight', null, 96, 96);
  const fill = node('Fill', root, 96, 96);
  await sprite(fill, 'art/board/cell', { color: [255, 196, 64, 80] });
  const border = node('Border', root, 96, 96);
  await sprite(border, 'art/ui/frame_gold');
  attach(root, 'HighlightView', { border: border.getComponent(cc.Sprite), fill: fill.getComponent(cc.Sprite) });
  return root;
}

async function buildBurstFx() {
  const root = node('BurstFx', null, 128, 128);
  await sprite(root, 'art/fx/spark');
  addAnim(root, ['burst']);
  attach(root, 'BurstFx', { spark: root.getComponent(cc.Sprite) });
  return root;
}

async function buildShockwaveFx() {
  const root = node('ShockwaveFx', null, 128, 128);
  await sprite(root, 'art/fx/shockwave');
  attach(root, 'ShockwaveFx', { ring: root.getComponent(cc.Sprite) });
  return root;
}

async function buildFrostFx() {
  const root = node('FrostFx', null, 96, 96);
  await sprite(root, 'art/fx/frost');
  attach(root, 'FrostFx', { flake: root.getComponent(cc.Sprite) });
  return root;
}

async function buildPrismFx() {
  const root = node('PrismFx', null, 160, 160);
  await sprite(root, 'art/fx/prism');
  attach(root, 'PrismFx', { wave: root.getComponent(cc.Sprite) });
  return root;
}

// ───────────────────────── 棋盘 ─────────────────────────
async function buildBoardLayers(root, withPieceView) {
  const tray = node('Tray', root, 638, 1010);
  const trayS = await sprite(tray, 'art/board/board_tray');
  const frame = node('Frame', root, 642, 1014);
  const frameS = await sprite(frame, 'art/board/board_frame');
  const grid = node('GridRoot', root, 620, 992);
  const fog = node('FogLayer', root, 620, 992);
  const blocks = node('BlockLayer', root, 620, 992);
  const piece = node('PieceLayer', root, 620, 992);
  const boardView = attach(root, 'BoardView', {
    gridRoot: grid,
    blockLayer: blocks,
    fogLayer: fog,
    tray: trayS,
    frame: frameS,
  });
  if (withPieceView) {
    const pv = attach(piece, 'PieceView', { pieceLayer: piece, ghostLayer: piece });
    boardView.pieceLayer = piece;
    void pv;
  }
  return { tray, frame, grid, fog, blocks, piece };
}

async function buildBoard() {
  const root = node('Board', null, 620, 992);
  const layers = await buildBoardLayers(root, false);
  void layers;
  return root;
}

// ───────────────────────── 局内 ─────────────────────────
async function buildHud() {
  const root = node('HUD', null, 750, 156);
  widget(root, { left: 0, right: 0, top: 0 });
  const brand = node('Brand', root, 220, 34, -250, 54);
  const brandL = label(brand, '落块消消', { size: 28, bold: true, align: 'left' });
  const title = node('Title', root, 220, 24, -250, 22);
  const titleL = label(title, 'TETRIS MATCH', { size: 15, color: [139, 115, 85], align: 'left' });

  const badgeHost = node('MutationBadgeHost', root, 200, 52, 40, 54);
  const bIcon = node('Icon', badgeHost, 40, 40, -72, 0);
  await sprite(bIcon, 'art/icon/mutation_frost');
  const bName = node('Name', badgeHost, 110, 24, 8, 10);
  const bNameL = label(bName, '糖霜雨', { size: 20, bold: true });
  const bCount = node('Countdown', badgeHost, 110, 20, 8, -12);
  const bCountL = label(bCount, '还有 6', { size: 15, color: [139, 115, 85] });
  const badge = attach(badgeHost, 'MutationBadgeView', {
    icon: bIcon.getComponent(cc.Sprite),
    nameLabel: bNameL,
    countdownLabel: bCountL,
  });
  badgeHost.active = false;

  const scoreCard = await panel(root, 'ScoreCard', 220, 96, -240, -34);
  const st = node('ScoreTitle', scoreCard, 190, 22, -8, 28);
  label(st, '得分', { size: 15, color: [139, 115, 85], align: 'left' });
  const sv = node('Score', scoreCard, 190, 44, -8, -2);
  const scoreL = label(sv, '0', { size: 38, bold: true, align: 'left' });
  const best = node('Best', scoreCard, 190, 22, -8, -34);
  const bestL = label(best, '最高 0', { size: 15, color: [139, 115, 85], align: 'right' });

  const levelCard = await panel(root, 'LevelCard', 170, 96, -35, -34);
  const lt = node('LevelTitle', levelCard, 140, 22, -6, 28);
  label(lt, '等级', { size: 15, color: [139, 115, 85], align: 'left' });
  const lv = node('Level', levelCard, 140, 38, -6, 2);
  const levelL = label(lv, '1', { size: 32, bold: true, align: 'left' });
  const track = node('ProgressTrack', levelCard, 140, 10, 0, -30);
  await sprite(track, 'art/ui/bar_track');
  const fill = node('ProgressFill', levelCard, 140, 10, 0, -30);
  const fillS = await sprite(fill, 'art/ui/bar_fill', { filled: true, fillRange: 0 });

  const goalCard = await panel(root, 'GoalCard', 170, 96, 135, -34);
  const gt = node('Goal', goalCard, 150, 40, 0, 14);
  const goalL = label(gt, '目标 1200', { size: 18, bold: true, wrap: true });
  const gv = node('GoalValue', goalCard, 150, 30, 0, -24);
  const goalVL = label(gv, '0/1200', { size: 16, color: [139, 115, 85] });
  goalCard.active = false;

  const nextCard = await panel(root, 'NextCard', 110, 96, 280, -34);
  const nt = node('NextTitle', nextCard, 90, 20, 0, 30);
  label(nt, 'NEXT', { size: 14, color: [139, 115, 85] });
  const nextSprites = [];
  for (let i = 0; i < 4; i++) {
    const n = node('NextCell_' + i, nextCard, 22, 22);
    nextSprites.push(await sprite(n, 'art/blocks/block_0'));
    n.active = false;
  }

  const pause = await button(root, 'Btn_Pause', 'Ⅱ', 'icon', 56, 56, 330, 54, 26);
  const restart = await button(root, 'Btn_Restart', '重', 'icon', 56, 56, 268, 54, 24);

  attach(root, 'HudView', {
    brandLabel: brandL,
    titleLabel: titleL,
    scoreLabel: scoreL,
    bestLabel: bestL,
    levelLabel: levelL,
    goalLabel: goalL,
    goalValueLabel: goalVL,
    progressFill: fillS,
    goalCard,
    mutationBadgeHost: badgeHost,
    nextCard,
    next0: nextSprites[0],
    next1: nextSprites[1],
    next2: nextSprites[2],
    next3: nextSprites[3],
    pauseBtn: pause.btn,
    restartBtn: restart.btn,
  });
  return root;
}

async function buildPad() {
  const root = node('Pad', null, 750, 172);
  widget(root, { left: 0, right: 0, bottom: 0 });
  const left = await button(root, 'Btn_Left', '←', 'secondary', 104, 104, -270, 14, 40);
  const right = await button(root, 'Btn_Right', '→', 'secondary', 104, 104, -150, 14, 40);
  const rotate = await button(root, 'Btn_Rotate', '旋', 'secondary', 104, 104, -30, 14, 32);
  const drop = await button(root, 'Btn_Drop', '直落', 'primary', 216, 104, 140, 14, 30);
  attach(root, 'PadView', {
    leftBtn: left.btn,
    rightBtn: right.btn,
    rotateBtn: rotate.btn,
    dropBtn: drop.btn,
  });
  return root;
}

async function buildSugarRail() {
  const root = node('SugarRail', null, 56, 992);
  const track = node('Track', root, 16, 820);
  await sprite(track, 'art/ui/bar_track');
  const fill = node('Fill', root, 16, 820);
  const fillS = await sprite(fill, 'art/ui/bar_fill', { filled: true, vertical: true });
  const percent = node('Percent', root, 60, 22, 0, -440);
  const percentL = label(percent, '0', { size: 16, color: [139, 115, 85] });
  const burst = await button(root, 'Btn_Burst', '爆', 'primary', 56, 56, 0, 430, 24);
  const dots = node('TalentDots', root, 56, 20, 0, 480);
  for (let i = 0; i < 3; i++) {
    const d = node('Dot_' + i, dots, 14, 14, -18 + i * 18, 0);
    await sprite(d, 'art/icon/icon_star');
    d.active = false;
  }
  const undo = await button(root, 'Btn_Undo', '撤', 'icon', 52, 52, 0, 370, 20);
  undo.node.active = false;
  const hint = await button(root, 'Btn_Hint', '灯', 'icon', 52, 52, 0, 308, 20);
  hint.node.active = false;
  attach(root, 'SugarRailView', {
    track: track.getComponent(cc.Sprite),
    fill: fillS,
    percentLabel: percentL,
    burstBtn: burst.btn,
    undoBtn: undo.btn,
    hintBtn: hint.btn,
    talentDots: dots,
  });
  return root;
}

async function buildShadowBar() {
  const root = node('ShadowBar', null, 620, 12);
  const track = node('Track', root, 620, 6);
  await sprite(track, 'art/ui/bar_track');
  const cur = node('Current', root, 6, 16);
  await sprite(cur, 'art/ui/bar_fill', { color: [78, 203, 138, 255] });
  const shadow = node('Shadow', root, 6, 16);
  await sprite(shadow, 'art/ui/bar_fill', { color: [169, 123, 240, 200] });
  const fx = node('OvertakeFx', root, 40, 40);
  await sprite(fx, 'art/fx/glow', { color: [255, 196, 64, 220] });
  fx.active = false;
  attach(root, 'ShadowBarView', {
    track: track.getComponent(cc.Sprite),
    current: cur,
    shadow,
    overtakeFx: fx,
  });
  return root;
}

async function buildMutationBadge() {
  const root = node('MutationBadge', null, 200, 52);
  const icon = node('Icon', root, 40, 40, -72, 0);
  await sprite(icon, 'art/icon/mutation_frost');
  const name = node('Name', root, 110, 24, 8, 10);
  const nameL = label(name, '糖霜雨', { size: 20, bold: true });
  const cd = node('Countdown', root, 110, 20, 8, -12);
  const cdL = label(cd, '还有 6', { size: 15, color: [139, 115, 85] });
  attach(root, 'MutationBadgeView', {
    icon: icon.getComponent(cc.Sprite),
    nameLabel: nameL,
    countdownLabel: cdL,
  });
  return root;
}

async function buildMutationIntro() {
  const root = node('MutationIntro', null, W, H);
  const mask = node('Mask', root, W, H);
  await sprite(mask, 'art/ui/mask');
  const card = await panel(root, 'Card', 560, 420, 0, 0, 'art/ui/panel_popup');
  const icon = node('Icon', card, 96, 96, 0, 120);
  await sprite(icon, 'art/icon/mutation_frost');
  const name = node('Name', card, 420, 44, 0, 46);
  const nameL = label(name, '糖霜雨', { size: 34, bold: true });
  const tier = node('Tier', card, 200, 24, 0, 8);
  const tierL = label(tier, '标准档', { size: 18, color: [139, 115, 85] });
  const rule = node('Rule', card, 460, 70, 0, -50);
  const ruleL = label(rule, '每 6 次锁定从底部插入一行霜石', { size: 20, color: [139, 115, 85], wrap: true });
  const skip = await button(card, 'Btn_Skip', '跳过', 'secondary', 240, 70, 0, -150, 24);
  addAnim(card, ['card-in']);
  attach(root, 'MutationIntroView', {
    icon: icon.getComponent(cc.Sprite),
    nameLabel: nameL,
    ruleLabel: ruleL,
    tierLabel: tierL,
    skipBtn: skip.btn,
  });
  root.active = false;
  return root;
}

async function buildGameScreen() {
  const root = node('GameScreen', null, W, H);
  widget(root, { left: 0, right: 0, top: 0, bottom: 0 });
  const bg = node('Bg', root, W, H);
  const bgS = await sprite(bg, 'art/bg/bg_ch1');

  const boardHost = node('BoardHost', root, 620, 992);
  const layers = await buildBoardLayers(boardHost, true);

  const hudNode = await buildHud();
  hudNode.setParent(root);
  const padNode = await buildPad();
  padNode.setParent(root);
  padNode.setPosition(0, -541, 0);
  const railNode = await buildSugarRail();
  railNode.setParent(root);
  railNode.setPosition(344, 0, 0);
  const shadowNode = await buildShadowBar();
  shadowNode.setParent(root);
  shadowNode.setPosition(0, 506, 0);
  const bannerNode = await buildBanner();
  bannerNode.setParent(root);
  bannerNode.setPosition(0, 80, 0);
  const floatNode = await buildFloatText();
  floatNode.setParent(root);
  const fx = node('FxLayer', root, W, H);

  attach(root, 'GameScreenView', {
    bg: bgS,
    boardHost,
    board: comp(boardHost, 'BoardView'),
    piece: comp(layers.piece, 'PieceView'),
    hud: comp(hudNode, 'HudView'),
    pad: comp(padNode, 'PadView'),
    sugarRail: comp(railNode, 'SugarRailView'),
    shadowBar: comp(shadowNode, 'ShadowBarView'),
    banner: comp(bannerNode, 'BannerView'),
    floats: comp(floatNode, 'FloatTextView'),
    mutationBadge: comp(hudNode.getChildByName('MutationBadgeHost'), 'MutationBadgeView'),
    fxLayer: fx,
    hudHost: hudNode.getComponent(cc.UITransform) ? hudNode : null,
    padHost: padNode,
  });
  attach(root, 'GameController', {});
  return root;
}

// ───────────────────────── 页面 ─────────────────────────
async function buildBoot() {
  const root = node('Boot', null, W, H);
  const bg = node('Bg', root, W, H);
  await sprite(bg, 'art/bg/bg_home');
  const logo = node('Logo', root, 600, 200, 0, 240);
  await sprite(logo, 'art/ui/logo');
  const bar = await buildProgressBar();
  bar.setParent(root);
  bar.setPosition(0, -80, 0);
  const tip = node('Tip', root, 520, 40, 0, -150);
  const tipL = label(tip, '正在准备糖果…', { size: 20, color: [139, 115, 85] });
  const ver = node('Version', root, 220, 30, 0, -600);
  const verL = label(ver, 'v2.0.0', { size: 16, color: [139, 115, 85] });
  attach(root, 'BootView', {
    logo: logo.getComponent(cc.Sprite),
    bar: comp(bar, 'ProgressBarView'),
    versionLabel: verL,
    tipLabel: tipL,
  });
  return root;
}

async function buildHome() {
  const root = node('Home', null, W, H);
  widget(root, { left: 0, right: 0, top: 0, bottom: 0 });
  const bg = node('Bg', root, W, H);
  await sprite(bg, 'art/bg/bg_home');
  const logo = node('Logo', root, 600, 200, 0, 420);
  await sprite(logo, 'art/ui/logo');
  const bestTag = await panel(root, 'BestTag', 300, 60, -30, 270, 'art/ui/panel_strip');
  const bestL = node('Best', bestTag, 280, 60);
  const bestLabel = label(bestL, '最高 0', { size: 22, color: [255, 252, 245] });
  const coinTag = await panel(root, 'CoinTag', 200, 56, 250, 270, 'art/ui/panel_strip');
  const coinL = node('Coin', coinTag, 160, 56, 14, 0);
  const coinLabel = label(coinL, '0', { size: 22, color: [255, 252, 245] });
  const coinIcon = node('Icon', coinTag, 28, 28, -70, 0);
  await sprite(coinIcon, 'art/icon/icon_coin');

  const endless = await button(root, 'Btn_Endless', '无尽模式', 'primary', 420, 110, 0, 80, 34);
  const levels = await button(root, 'Btn_Levels', '关卡模式', 'secondary', 420, 100, 0, -50, 30);
  const daily = await button(root, 'Btn_Daily', '每日残局', 'secondary', 420, 100, 0, -165, 30);
  const replay = await button(root, 'Btn_Replay', '观看最佳局', 'ghost', 300, 70, 0, -265, 24);
  const settings = await button(root, 'Btn_Settings', '设', 'icon', 80, 80, 320, 560, 28);
  const hint = node('Hint', root, 600, 40, 0, -560);
  const hintL = label(hint, '拖动移动 · 轻点旋转', { size: 18, color: [139, 115, 85] });

  attach(root, 'HomeView', {
    logo: logo.getComponent(cc.Sprite),
    endlessBtn: endless.btn,
    levelsBtn: levels.btn,
    dailyBtn: daily.btn,
    replayBtn: replay.btn,
    settingsBtn: settings.btn,
    coinLabel,
    bestLabel,
    hintLabel: hintL,
  });
  return root;
}

async function buildLevelNode() {
  const root = node('LevelNode', null, 150, 104);
  const s = await sprite(root, 'art/ui/panel_card');
  const idx = node('Index', root, 44, 28, -48, 30);
  const idxL = label(idx, '1', { size: 20, bold: true, color: [139, 115, 85] });
  const nm = node('Name', root, 130, 26, 0, 2);
  const nmL = label(nm, '初雪庭院', { size: 18 });
  const stars = node('Stars', root, 130, 20, 0, -22);
  const starsL = label(stars, '★★', { size: 16, color: [255, 196, 64] });
  const lock = node('Lock', root, 30, 30, 52, -34);
  await sprite(lock, 'art/icon/icon_lock');
  lock.active = false;
  const mut = node('MutationIcon', root, 26, 26, 56, 32);
  await sprite(mut, 'art/icon/mutation_frost');
  mut.active = false;
  const b = root.addComponent(cc.js.getClassByName('UIButton'));
  b.skin = 'secondary';
  b.bg = s;
  attach(root, 'LevelNodeView', {
    indexLabel: idxL,
    nameLabel: nmL,
    starsLabel: starsL,
    lock,
    mutationIcon: mut.getComponent(cc.Sprite),
    button: b,
  });
  return root;
}

async function buildChapterTab() {
  const root = node('ChapterTab', null, 116, 70);
  const s = await sprite(root, 'art/ui/btn_secondary');
  const icon = node('Icon', root, 34, 34, -38, 0);
  await sprite(icon, 'art/icon/chapter_1');
  const nm = node('Name', root, 78, 22, 12, 14);
  const nmL = label(nm, '糖霜庭院', { size: 14, bold: true });
  const st = node('Stars', root, 78, 18, 12, -12);
  const stL = label(st, '0/60 ★', { size: 12, color: [139, 115, 85] });
  const lock = node('Lock', root, 22, 22, 44, 24);
  await sprite(lock, 'art/icon/icon_lock');
  lock.active = false;
  const b = root.addComponent(cc.js.getClassByName('UIButton'));
  b.skin = 'tab';
  b.bg = s;
  attach(root, 'ChapterTabView', {
    icon: icon.getComponent(cc.Sprite),
    nameLabel: nmL,
    starsLabel: stL,
    lock,
    button: b,
  });
  return root;
}

async function buildChapterMap() {
  const root = node('ChapterMap', null, W, H);
  widget(root, { left: 0, right: 0, top: 0, bottom: 0 });
  const bg = node('Bg', root, W, H);
  await sprite(bg, 'art/bg/bg_home');
  const title = node('Title', root, 500, 50, 0, 570);
  const titleL = label(title, '关卡地图', { size: 34, bold: true });
  const prog = node('Progress', root, 500, 30, 0, 520);
  const progL = label(prog, '本章 0/20', { size: 18, color: [139, 115, 85] });
  const tabs = node('Tabs', root, 730, 70, 0, 450);
  horizLayout(tabs, 6);
  for (let i = 1; i <= 6; i++) {
    const tab = await buildChapterTab();
    tab.name = 'Tab_' + i;
    tab.setParent(tabs);
  }
  const grid = node('LevelGrid', root, 700, 880, 0, -70);
  gridLayout(grid, 4, 158, 112, 8, 8, 4);
  const back = await button(root, 'Btn_Back', '返回', 'secondary', 160, 80, -270, -570, 26);
  attach(root, 'ChapterMapView', {
    tabsRoot: tabs,
    levelGrid: grid,
    progressLabel: progL,
    titleLabel: titleL,
    backBtn: back.btn,
  });
  return root;
}

async function buildDayCell() {
  const root = node('DayCell', null, 84, 52);
  const s = await sprite(root, 'art/ui/panel_card');
  const today = node('Today', root, 84, 52);
  await sprite(today, 'art/ui/frame_gold');
  today.active = false;
  const d = node('Day', root, 70, 28, 0, 8);
  const dL = label(d, '1', { size: 18, bold: true });
  const st = node('State', root, 70, 16, 0, -12);
  const stL = label(st, '完成', { size: 12, color: [139, 115, 85] });
  const star = node('Star', root, 14, 14, 28, 16);
  await sprite(star, 'art/icon/star_filled');
  star.active = false;
  const b = root.addComponent(cc.js.getClassByName('UIButton'));
  b.skin = 'secondary';
  b.bg = s;
  attach(root, 'DayCellView', { dayLabel: dL, stateLabel: stL, star, today, button: b });
  return root;
}

async function buildDailyPanel() {
  const root = node('DailyPanel', null, W, H);
  widget(root, { left: 0, right: 0, top: 0, bottom: 0 });
  const bg = node('Bg', root, W, H);
  await sprite(bg, 'art/bg/bg_daily');
  const title = node('Title', root, 500, 50, 0, 590);
  const titleL = label(title, '每日残局', { size: 34, bold: true });
  const month = node('Month', root, 300, 30, -180, 540);
  const monthL = label(month, '1 月', { size: 20, bold: true, align: 'left' });
  const cal = node('Calendar', root, 690, 420, 0, 300);
  gridLayout(cal, 7, 92, 56, 4, 4, 2);
  const goal = node('Goal', root, 620, 36, 0, 40);
  const goalL = label(goal, '目标', { size: 20, bold: true });
  const status = node('Status', root, 620, 30, 0, 0);
  const statusL = label(status, '', { size: 17, color: [139, 115, 85] });
  const streak = node('Streak', root, 400, 30, 0, -40);
  const streakL = label(streak, '连续 0 天', { size: 18, color: [139, 115, 85] });
  const play = await button(root, 'Btn_Play', '开始挑战', 'primary', 420, 96, 0, -160, 30);
  const hint = await button(root, 'Btn_Hint', '提示（30 金币）', 'secondary', 320, 72, 0, -270, 24);
  const back = await button(root, 'Btn_Back', '返回', 'secondary', 160, 80, -270, -570, 26);
  attach(root, 'DailyPanelView', {
    calendar: cal,
    goalLabel: goalL,
    streakLabel: streakL,
    monthLabel: monthL,
    statusLabel: statusL,
    playBtn: play.btn,
    hintBtn: hint.btn,
    backBtn: back.btn,
  });
  return root;
}

async function buildSettings() {
  const root = node('Settings', null, W, H);
  const mask = node('Mask', root, W, H);
  await sprite(mask, 'art/ui/mask');
  const card = await panel(root, 'Card', 600, 480, 0, 0, 'art/ui/panel_popup');
  const title = node('Title', card, 400, 50, 0, 180);
  label(title, '设置', { size: 34, bold: true });
  const mute = await button(card, 'Btn_Mute', '音效：开', 'secondary', 420, 90, 0, 60, 26);
  const credits = await button(card, 'Btn_Credits', '制作名单', 'ghost', 420, 80, 0, -50, 24);
  const creditsL = node('Credits', card, 500, 60, 0, -140);
  const creditsLabel = label(creditsL, '', { size: 18, color: [139, 115, 85], wrap: true });
  const back = await button(card, 'Btn_Back', '返回', 'primary', 420, 80, 0, -210, 26);
  attach(root, 'SettingsView', {
    muteBtn: mute.btn,
    creditsBtn: credits.btn,
    backBtn: back.btn,
    creditsLabel,
  });
  return root;
}

async function buildReplay() {
  const root = node('Replay', null, W, H);
  const bg = node('Bg', root, W, H);
  await sprite(bg, 'art/bg/bg_result');
  const title = node('Title', root, 500, 50, 0, 600);
  const titleL = label(title, '最佳局回放', { size: 30, bold: true });
  const host = node('BoardHost', root, 560, 896, 0, 60);
  const layers = await buildBoardLayers(host, false);
  void layers;
  const score = node('Score', root, 240, 50, -200, -470);
  const scoreL = label(score, '0', { size: 34, bold: true });
  const time = node('Time', root, 300, 30, 80, -470);
  const timeL = label(time, '0 锁', { size: 18, color: [139, 115, 85] });
  const slider = node('Slider', root, 500, 20, 0, -520);
  await sprite(slider, 'art/ui/bar_track');
  const play = await button(root, 'Btn_Play', '播放', 'primary', 180, 80, -220, -590, 26);
  const speed = await button(root, 'Btn_Speed', '1×', 'secondary', 110, 64, -60, -590, 22);
  const close = await button(root, 'Btn_Close', '关闭', 'secondary', 160, 70, 240, -590, 24);
  attach(root, 'ReplayView', {
    board: comp(host, 'BoardView'),
    scoreLabel: scoreL,
    timeLabel: timeL,
    titleLabel: titleL,
    playBtn: play.btn,
    speedBtn: speed.btn,
    closeBtn: close.btn,
  });
  return root;
}

async function buildBackground() {
  const root = node('Background', null, W, H);
  const fill = node('BgFill', root, W, H);
  await sprite(fill, 'art/bg/bg_home');
  const art = node('BgArt', root, W, H);
  await sprite(art, 'art/bg/bg_home');
  const vig = node('Vignette', root, W, H);
  await sprite(vig, 'art/ui/mask', { color: [40, 20, 10, 40] });
  attach(root, 'BackgroundView', {
    bgFill: fill.getComponent(cc.Sprite),
    bgArt: art.getComponent(cc.Sprite),
    vignette: vig.getComponent(cc.Sprite),
  });
  return root;
}

async function buildDialog() {
  const root = node('Dialog', null, W, H);
  const mask = node('Mask', root, W, H);
  await sprite(mask, 'art/ui/mask');
  const card = await panel(root, 'Card', 600, 560, 0, 20, 'art/ui/panel_popup');
  const tag = node('Tag', card, 500, 28, 0, 224);
  const tagL = label(tag, 'GAME OVER', { size: 18, color: [139, 115, 85] });
  const title = node('Title', card, 500, 50, 0, 178);
  const titleL = label(title, '堆到顶了', { size: 36, bold: true });
  const score = node('Score', card, 500, 90, 0, 102);
  const scoreL = label(score, '0', { size: 72, bold: true, color: [78, 203, 138] });
  const sub = node('Subtitle', card, 500, 40, 0, 28);
  const subL = label(sub, '', { size: 20, color: [139, 115, 85] });
  const starRow = await buildStarRow();
  starRow.setParent(card);
  starRow.setPosition(0, -50, 0);
  const primary = await button(card, 'Btn_Primary', '再来一局', 'primary', 500, 92, 0, -140, 30);
  const secondary = await button(card, 'Btn_Secondary', '返回首页', 'secondary', 500, 70, 0, -226, 24);
  addAnim(card, ['dialog-in']);
  attach(root, 'DialogView', {
    mask,
    card,
    tagLabel: tagL,
    titleLabel: titleL,
    scoreLabel: scoreL,
    subtitleLabel: subL,
    starRow: comp(starRow, 'StarRowView'),
    primaryBtn: primary.btn,
    secondaryBtn: secondary.btn,
  });
  root.active = false;
  return root;
}

async function buildTalentCard() {
  const root = node('TalentCard', null, 220, 320);
  const s = await sprite(root, 'art/ui/panel_card');
  const frame = node('RarityFrame', root, 224, 324);
  await sprite(frame, 'art/ui/frame_gold');
  frame.active = false;
  const icon = node('Icon', root, 80, 80, 0, 96);
  await sprite(icon, 'art/icon/talent_score');
  const cat = node('Category', root, 30, 30, -82, 132);
  await sprite(cat, 'art/icon/talent_score');
  const nm = node('Name', root, 200, 34, 0, 30);
  const nmL = label(nm, '甜度加成', { size: 22, bold: true });
  const eff = node('Effect', root, 190, 80, 0, -50);
  const effL = label(eff, '所有得分 +8%', { size: 16, color: [139, 115, 85], wrap: true });
  const rar = node('Rarity', root, 200, 22, 0, -140);
  const rarL = label(rar, '普通', { size: 14, color: [139, 115, 85] });
  const b = root.addComponent(cc.js.getClassByName('UIButton'));
  b.skin = 'secondary';
  b.bg = s;
  attach(root, 'TalentCardView', {
    rarityFrame: frame.getComponent(cc.Sprite),
    icon: icon.getComponent(cc.Sprite),
    categoryIcon: cat.getComponent(cc.Sprite),
    nameLabel: nmL,
    effectLabel: effL,
    rarityLabel: rarL,
    button: b,
  });
  return root;
}

async function buildTalentPicker() {
  const root = node('TalentPicker', null, W, H);
  const mask = node('Mask', root, W, H);
  await sprite(mask, 'art/ui/mask');
  const title = node('Title', root, 500, 60, 0, 420);
  const titleL = label(title, '选择一项天赋', { size: 34, bold: true });
  const cards = node('Cards', root, 740, 340, 0, 100);
  horizLayout(cards, 20);
  const skip = await button(root, 'Btn_Skip', '跳过 +15', 'secondary', 300, 80, 0, -400, 26);
  attach(root, 'TalentPickerView', {
    cardsRoot: cards,
    titleLabel: titleL,
    skipBtn: skip.btn,
  });
  root.active = false;
  return root;
}

async function buildColorPicker() {
  const root = node('ColorPicker', null, W, H);
  const mask = node('Mask', root, W, H);
  await sprite(mask, 'art/ui/mask');
  const card = await panel(root, 'Card', 600, 360, 0, 0, 'art/ui/panel_popup');
  const title = node('Title', card, 500, 50, 0, 120);
  label(title, '选择颜色', { size: 30, bold: true });
  const chips = node('Chips', card, 500, 110, 0, 20);
  horizLayout(chips, 16);
  for (let i = 0; i < 5; i++) {
    const chip = node('Chip_' + i, chips, 80, 80);
    await sprite(chip, 'art/blocks/block_' + i);
    chip.addComponent(cc.js.getClassByName('UIButton')).skin = 'ghost';
  }
  const cancel = await button(card, 'Btn_Cancel', '取消', 'secondary', 300, 70, 0, -110, 24);
  attach(root, 'ColorPickerView', { chipsRoot: chips, cancelBtn: cancel.btn });
  root.active = false;
  return root;
}

// ───────────────────────── 主流程 ─────────────────────────
if (FONT_UUID) {
  FONT = await new Promise((resolve) => {
    cc.assetManager.loadAny({ uuid: FONT_UUID }, (err, a) => resolve(err ? null : a));
  });
}
for (const key of Object.keys(ANIM_UUIDS)) {
  CLIPS[key] = await new Promise((resolve) => {
    cc.assetManager.loadAny({ uuid: ANIM_UUIDS[key] }, (err, a) => resolve(err ? null : a));
  });
}

function addAnim(node, keys) {
  const clips = keys.map((k) => CLIPS[k]).filter(Boolean);
  if (clips.length === 0) return null;
  const anim = node.addComponent(cc.Animation);
  anim.clips = clips;
  return anim;
}

const specs = [
  ['boot', 'ui/Boot', buildBoot],
  ['home', 'ui/Home', buildHome],
  ['chapterMap', 'ui/ChapterMap', buildChapterMap],
  ['chapterTab', 'ui/ChapterTab', buildChapterTab],
  ['levelNode', 'ui/LevelNode', buildLevelNode],
  ['dailyPanel', 'ui/DailyPanel', buildDailyPanel],
  ['dayCell', 'ui/DayCell', buildDayCell],
  ['settings', 'ui/Settings', buildSettings],
  ['replay', 'ui/Replay', buildReplay],
  ['background', 'ui/Background', buildBackground],
  ['gameScreen', 'game/GameScreen', buildGameScreen],
  ['hud', 'game/HUD', buildHud],
  ['pad', 'game/Pad', buildPad],
  ['sugarRail', 'game/SugarRail', buildSugarRail],
  ['board', 'game/Board', buildBoard],
  ['gridCell', 'game/GridCell', buildGridCell],
  ['block', 'game/Block', buildBlock],
  ['pieceCell', 'game/PieceCell', buildPieceCell],
  ['ghostCell', 'game/GhostCell', buildGhostCell],
  ['fogCell', 'game/FogCell', buildFogCell],
  ['shadowBar', 'game/ShadowBar', buildShadowBar],
  ['mutationBadge', 'game/MutationBadge', buildMutationBadge],
  ['mutationIntro', 'game/MutationIntro', buildMutationIntro],
  ['highlight', 'game/Highlight', buildHighlight],
  ['dialog', 'ui/Dialog', buildDialog],
  ['toast', 'ui/Toast', buildToast],
  ['banner', 'ui/Banner', buildBanner],
  ['floatText', 'ui/FloatText', buildFloatText],
  ['talentPicker', 'ui/TalentPicker', buildTalentPicker],
  ['talentCard', 'ui/TalentCard', buildTalentCard],
  ['colorPicker', 'ui/ColorPicker', buildColorPicker],
  ['starRow', 'ui/StarRow', buildStarRow],
  ['button', 'ui/Button', buildButtonPrefab],
  ['progressBar', 'ui/ProgressBar', buildProgressBar],
  ['burstFx', 'fx/BurstFx', buildBurstFx],
  ['shockwaveFx', 'fx/ShockwaveFx', buildShockwaveFx],
  ['frostFx', 'fx/FrostFx', buildFrostFx],
  ['prismFx', 'fx/PrismFx', buildPrismFx],
];

// 分批执行：每批 < 5s，避免编辑器 "Scene Not Response" 看门狗；
// 节点独立构建后用 EditorExtends.serialize 序列化，主进程直接写 .prefab 文件，
// 全程不调用 scene:create-prefab（它可能弹原生保存对话框）。
const batch = args.batch || { start: 0, count: specs.length };
const from = Math.max(0, batch.start | 0);
const to = Math.min(specs.length, from + Math.max(1, batch.count | 0));
const items = [];
for (let i = from; i < to; i++) {
  const [key, rel, fn] = specs[i];
  const root = await fn();
  root.name = rel.split('/').pop();
  items.push({ key, rel, name: root.name, json: EditorExtends.serialize(root) });
  root.destroy();
}
return { items, from, to, total: specs.length };
