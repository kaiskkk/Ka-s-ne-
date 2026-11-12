// ─────────────────────────────────────────────────────────────
//  Kit d'interface des menus : gros boutons arrondis à contour épais et
//  ombre (qui s'enfoncent quand on appuie), panneaux, jauges, pastilles,
//  compteurs animés… Tous les écrans de menu sont construits avec.
// ─────────────────────────────────────────────────────────────
import { ICON_PX } from '../art/uiArt.js';
import { addText, fitWidth } from './theme.js';

/** Rectangle de référence des menus : un iPhone tenu en paysage. */
export const REF_W = 844;
export const REF_H = 390;
/** Couleur des contours épais. */
export const INK = 0x0a0d18;

/** Palettes des boutons : clair (haut), base, tranche (épaisseur), contour du texte. */
export const PAL = {
  yellow: { light: 0xffe680, base: 0xffc21f, shade: 0xa86a00, stroke: '#7a4a00' },
  blue: { light: 0x6cc0ff, base: 0x2f8be6, shade: 0x14478a, stroke: '#0f3566' },
  green: { light: 0x8ff07a, base: 0x3fbf52, shade: 0x17702a, stroke: '#0f4a1a' },
  red: { light: 0xff8f8f, base: 0xe8404f, shade: 0x8a1626, stroke: '#5a0f1a' },
  purple: { light: 0xd3a6ff, base: 0x9455e6, shade: 0x4c2390, stroke: '#35186a' },
  dark: { light: 0x46548a, base: 0x2b355e, shade: 0x121830, stroke: '#0a0d18' },
  gray: { light: 0x9aa3bd, base: 0x6b7594, shade: 0x343a52, stroke: '#23283a' },
};

/** 12500 → « 12 500 » */
export function fmt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Image de l'atlas « ui » affichée à `size` pixels de large. */
export function icon(scene, frame, x, y, size, depth = 10) {
  const img = scene.add.image(x, y, 'ui', frame).setDepth(depth);
  img.setScale(size / img.frame.width);
  return img;
}

/** Icône correspondant à une récompense { coins | gems | xp | chest }. */
export function rewardFrame(reward) {
  if (reward.chest) return `chest_${reward.chest}`;
  if (reward.gems) return 'gem';
  if (reward.xp) return 'xp';
  return 'coin';
}

export function rewardLabel(reward) {
  if (reward.chest) return 'Coffre';
  if (reward.gems) return fmt(reward.gems);
  if (reward.xp) return `${fmt(reward.xp)} XP`;
  return fmt(reward.coins || 0);
}

/** Panneau arrondi à contour épais, avec ombre et bandeau de titre optionnel. */
export function panel(scene, x, y, w, h, o = {}) {
  const g = scene.add.graphics().setDepth(o.depth ?? 0);
  const r = o.radius ?? 16;
  if (o.shadow !== false) {
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x + 1, y + 6, w, h, r);
  }
  g.fillStyle(INK, 1);
  g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, r + 3);
  g.fillStyle(o.fill ?? 0x1c2547, 1);
  g.fillRoundedRect(x, y, w, h, r);
  if (o.header != null) {
    g.fillStyle(o.header, 1);
    g.fillRoundedRect(x, y, w, o.headerH ?? 30, { tl: r, tr: r, bl: 0, br: 0 });
  }
  g.lineStyle(2, 0xffffff, 0.09);
  g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, Math.max(2, r - 2));
  return g;
}

/**
 * Gros bouton. Options : x, y, w, h, label, sub (petite ligne), color (clé de PAL),
 * icon (image de l'atlas « ui »), iconSize, suffix (icône après le texte),
 * layout ('row' | 'col'), size (taille du texte), enabled, onTap, depth.
 * Renvoie { c (conteneur), label, setEnabled(), setLabel(), hit }.
 */
export function button(scene, buttons, o) {
  const { x, y, w, h } = o;
  let enabled = o.enabled !== false;
  const lip = o.lip ?? Math.max(4, Math.round(h * 0.11));
  const r = Math.min(o.radius ?? 14, h / 2);
  const c = scene.add.container(x + w / 2, y + h / 2).setDepth(o.depth ?? 10);
  const g = scene.add.graphics();
  c.add(g);
  const paint = () => {
    const pal = PAL[enabled ? o.color || 'blue' : 'gray'];
    g.clear();
    g.fillStyle(0x000000, 0.26);
    g.fillRoundedRect(-w / 2, -h / 2 + lip + 4, w, h, r);
    g.fillStyle(INK, 1);
    g.fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + lip + 6, r + 3);
    g.fillStyle(pal.shade, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + lip, w, h, r);
    g.fillStyle(pal.base, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(pal.light, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h * 0.5, { tl: r, tr: r, bl: 0, br: 0 });
    g.fillStyle(0xffffff, 0.34);
    g.fillRoundedRect(-w / 2 + 7, -h / 2 + 4, w - 14, Math.max(3, Math.min(7, h * 0.14)), 3);
  };
  paint();

  const pal = PAL[o.color || 'blue'];
  const col = o.layout === 'col';
  const iconSize = o.iconSize ?? (col ? h * 0.5 : h * 0.62);
  let img = null;
  let label = null;
  let sub = null;
  let suffix = null;
  if (o.icon) {
    img = scene.add.image(0, 0, 'ui', o.icon);
    img.setScale(iconSize / img.frame.width);
    c.add(img);
  }
  if (o.label != null) {
    label = addText(scene, 0, 0, o.label, { size: o.size ?? 16, ox: 0.5, oy: 0.5, stroke: pal.stroke, strokeW: o.strokeW ?? 4 });
    c.add(label);
  }
  if (o.sub != null) {
    sub = addText(scene, 0, 0, o.sub, { size: o.subSize ?? 10, ox: 0.5, oy: 0.5, color: '#fff6c8', stroke: pal.stroke, strokeW: 3 });
    c.add(sub);
  }
  if (o.suffix) {
    suffix = scene.add.image(0, 0, 'ui', o.suffix);
    suffix.setScale((o.suffixSize ?? h * 0.5) / suffix.frame.width);
    c.add(suffix);
  }
  const arrange = () => {
    if (col) {
      if (img) img.setPosition(0, label ? -h * 0.14 : 0);
      if (label) {
        fitWidth(label, w - 10);
        label.setPosition(0, img ? h * 0.3 : 0);
      }
      return;
    }
    // En ligne : [icône] texte [icône], le tout centré
    const gap = 6;
    if (label) fitWidth(label, w - 18 - (img ? iconSize + gap : 0) - (suffix ? suffix.displayWidth + gap : 0));
    const lw = label ? label.displayWidth : 0;
    const total = (img ? iconSize + (label ? gap : 0) : 0) + lw + (suffix ? suffix.displayWidth + gap : 0);
    let cx = -total / 2;
    const ty = sub ? -h * 0.13 : -1;
    if (img) {
      img.setPosition(cx + iconSize / 2, sub ? ty : -1);
      cx += iconSize + (label ? gap : 0);
    }
    if (label) {
      label.setPosition(cx + lw / 2, ty);
      cx += lw + gap;
    }
    if (suffix) suffix.setPosition(cx + suffix.displayWidth / 2, ty);
    if (sub) {
      fitWidth(sub, w - 14);
      sub.setPosition(0, h * 0.27);
    }
  };
  arrange();

  const api = {
    c,
    label,
    sub,
    hit: null,
    setEnabled(v) {
      if (enabled === v) return;
      enabled = v;
      paint();
      api.hit.sound = v ? o.sound : 'deny';
    },
    setLabel(text) {
      if (!label) return;
      label.setText(text);
      arrange();
    },
  };
  api.hit = buttons.add({
    id: o.id, // facultatif : nom du bouton, pour les tests de bout en bout
    x: x - 3,
    y: y - 3,
    w: w + 6,
    h: h + lip + 6,
    sound: enabled ? o.sound : 'deny',
    onPress: (pressed) => {
      scene.tweens.add({ targets: c, scaleX: pressed ? 0.94 : 1, scaleY: pressed ? 0.9 : 1, duration: 70, ease: 'Quad.easeOut' });
    },
    onTap: () => {
      if (!enabled) {
        // Refus : le bouton fait « non » de la tête
        scene.tweens.add({ targets: c, angle: { from: -4, to: 4 }, duration: 60, yoyo: true, repeat: 1, onComplete: () => c.setAngle(0) });
        if (o.onDenied) o.onDenied();
        return;
      }
      if (o.onTap) o.onTap();
    },
  });
  return api;
}

/** Pastille rouge de notification (nombre de récompenses en attente). */
export function badge(scene, x, y, n, depth = 20) {
  if (!n) return null;
  const c = scene.add.container(x, y).setDepth(depth);
  const g = scene.add.graphics();
  g.fillStyle(INK, 1);
  g.fillCircle(0, 0, 10.5);
  g.fillStyle(0xff3b4e, 1);
  g.fillCircle(0, 0, 8.5);
  c.add([g, addText(scene, 0, -0.5, String(n), { size: 11, ox: 0.5, oy: 0.5 })]);
  scene.tweens.add({ targets: c, scale: 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return c;
}

/** Jauge horizontale à contour épais. Renvoie { g, set(pct) }. */
export function bar(scene, x, y, w, h, pct, color, o = {}) {
  const g = scene.add.graphics().setDepth(o.depth ?? 5);
  const api = {
    g,
    pct: 0,
    set(p) {
      api.pct = Math.max(0, Math.min(1, p));
      g.clear();
      g.fillStyle(INK, 1);
      g.fillRoundedRect(x - 2.5, y - 2.5, w + 5, h + 5, h / 2 + 2.5);
      g.fillStyle(o.back ?? 0x0f1530, 1);
      g.fillRoundedRect(x, y, w, h, h / 2);
      if (api.pct > 0) {
        const fw = Math.max(h, w * api.pct);
        g.fillStyle(color, 1);
        g.fillRoundedRect(x, y, fw, h, h / 2);
        g.fillStyle(0xffffff, 0.35);
        g.fillRoundedRect(x + 3, y + 1.5, Math.max(2, fw - 6), Math.max(1.5, h * 0.3), 1.5);
      }
    },
  };
  api.set(pct);
  return api;
}

/** Fait défiler un nombre affiché de `from` à `to`. */
export function countUp(scene, text, from, to, duration = 600, format = fmt) {
  const state = { v: from };
  text.setText(format(from));
  if (from === to) return null;
  return scene.tweens.add({
    targets: state,
    v: to,
    duration,
    ease: 'Cubic.easeOut',
    onUpdate: () => text.setText(format(state.v)),
    onComplete: () => text.setText(format(to)),
  });
}

/** Message bref en bas de l'écran (« Pas assez de pièces ! »). */
export function toast(scene, message, color = '#ffffff') {
  if (scene.toastText) scene.toastText.destroy();
  const t = addText(scene, REF_W / 2, REF_H - 96, message, { size: 15, ox: 0.5, oy: 0.5, color, stroke: '#0a0d18', strokeW: 5, depth: 500 });
  scene.toastText = t;
  t.setScale(0.6);
  scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: t,
    alpha: 0,
    y: REF_H - 116,
    delay: 1100,
    duration: 300,
    onComplete: () => {
      if (scene.toastText === t) scene.toastText = null;
      t.destroy();
    },
  });
}

/** Petites icônes qui s'envolent d'un point vers un autre (pièces vers le compteur…). */
export function flyIcons(scene, frame, from, to, count = 6, size = 20) {
  for (let i = 0; i < count; i++) {
    const img = icon(scene, frame, from.x + (Math.random() - 0.5) * 24, from.y + (Math.random() - 0.5) * 24, size, 600);
    scene.tweens.add({
      targets: img,
      x: to.x,
      y: to.y,
      scale: img.scale * 0.6,
      delay: i * 45,
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => img.destroy(),
    });
  }
}

export { ICON_PX };
