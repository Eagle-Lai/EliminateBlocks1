// 场景改造：UIRoot + 四层 + UIManager 绑定 + GameEntry.uiRoot 引用。全部走引擎 API。
const scene = cc.director.getScene();
const canvas = scene.getChildByName('Canvas');
if (!canvas) throw new Error('Canvas not found');

function findChild(parent, name) {
  return parent.children.find((c) => c.name === name) || null;
}

const oldRoot = findChild(canvas, 'UIRoot');
if (oldRoot) oldRoot.destroy();

function makeNode(name, parent, w, h) {
  const n = new cc.Node(name);
  n.layer = 33554432;
  const ui = n.addComponent(cc.UITransform);
  ui.setContentSize(w, h);
  n.setParent(parent);
  n.setPosition(0, 0, 0);
  return n;
}

function stretch(n) {
  const w = n.addComponent(cc.Widget);
  w.isAlignLeft = true;
  w.isAlignRight = true;
  w.isAlignTop = true;
  w.isAlignBottom = true;
  w.left = 0;
  w.right = 0;
  w.top = 0;
  w.bottom = 0;
  w.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
}

const root = makeNode('UIRoot', canvas, 750, 1334);
stretch(root);

const layers = {};
for (const layer of ['Layer_Scene', 'Layer_Panel', 'Layer_Popup', 'Layer_Toast']) {
  const n = makeNode(layer, root, 750, 1334);
  stretch(n);
  layers[layer] = n;
}

const managerCls = cc.js.getClassByName('UIManager');
const manager = root.addComponent(managerCls);
manager.layerScene = layers.Layer_Scene;
manager.layerPanel = layers.Layer_Panel;
manager.layerPopup = layers.Layer_Popup;
manager.layerToast = layers.Layer_Toast;

const entryCls = cc.js.getClassByName('GameEntry');
const entry = canvas.getComponent(entryCls);
if (!entry) throw new Error('GameEntry missing');
entry.uiRoot = root;

const canvasComp = canvas.getComponent(cc.Canvas);
if (canvasComp && canvasComp.cameraComponent) {
  canvasComp.cameraComponent.clearColor = new cc.Color(246, 230, 211, 255);
}

return {
  root: root.uuid,
  layers: Object.keys(layers),
  manager: !!root.getComponent(managerCls),
  entryBound: entry.uiRoot === root,
};
