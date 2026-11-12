// ─────────────────────────────────────────────────────────────
//  ShopScene — la boutique : offres du jour (dont un cadeau gratuit)
//  et coffres à ouvrir. Tout s'achète avec la monnaie du jeu, gagnée en
//  jouant : il n'y a aucun achat en argent réel.
// ─────────────────────────────────────────────────────────────
import { CHESTS } from '../../config/meta.js';
import { profile } from '../../meta/profile.js';
import { button, fmt, icon, panel, rewardFrame, toast } from '../../ui/kit.js';
import { addText, fitWidth } from '../../ui/theme.js';
import { MenuBase } from './MenuBase.js';

function priceOf(price) {
  if (price.gems) return { label: fmt(price.gems), suffix: 'gem' };
  if (price.coins) return { label: fmt(price.coins), suffix: 'coin' };
  return { label: 'GRATUIT', suffix: null };
}

function missing(price) {
  if (price.gems && profile.data.gems < price.gems) return `Il te manque ${fmt(price.gems - profile.data.gems)} gemmes`;
  return `Il te manque ${fmt((price.coins || 0) - profile.data.coins)} pièces`;
}

/** « 5 h 12 » avant minuit (renouvellement des offres). */
function untilMidnight() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const min = Math.max(1, Math.round((end - now) / 60000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export class ShopScene extends MenuBase {
  constructor() {
    super('Shop');
  }

  create() {
    this.begin();
    this.drawBackdrop('feu', { rays: 0.1 });
    this.drawHeader('BOUTIQUE', 'Uniquement de la monnaie gagnée en jouant');
    this.drawCurrencies();
    this.drawOffers();
    this.drawChests();
  }

  /** Après un achat : on redessine l'écran (prix, « reçu », compteurs). */
  reload() {
    this.scene.restart({ slide: 0 });
  }

  // ── Offres du jour ─────────────────────────────────────────

  drawOffers() {
    const x = 14;
    const y = 58;
    const w = 292;
    panel(this, x, y, w, 320, { fill: 0x18204a, header: 0xa83246, headerH: 30 });
    addText(this, x + 12, y + 15, 'OFFRES DU JOUR', { size: 13.5, oy: 0.5, depth: 2 });
    icon(this, 'clock', x + w - 76, y + 15, 16, 2);
    addText(this, x + w - 64, y + 15, untilMidnight(), { size: 11, oy: 0.5, color: '#ffd9dd', depth: 2 });

    profile.dailyOffers().forEach((o, i) => {
      const ry = y + 38 + i * 94;
      panel(this, x + 8, ry, w - 16, 86, { fill: o.free ? 0x1f4a3a : 0x222c5a, radius: 12, shadow: false });
      const frame = o.free ? 'gift' : rewardFrame(o.reward);
      const img = icon(this, frame, x + 44, ry + 43, o.reward.chest ? 62 : 46, 3);
      if (!o.bought) this.tweens.add({ targets: img, y: img.y - 3, duration: 800 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      fitWidth(addText(this, x + 82, ry + 22, o.title, { size: 14.5, oy: 0.5, depth: 3 }), w - 196);
      fitWidth(addText(this, x + 82, ry + 42, o.desc, { size: 11, oy: 0.5, color: o.free ? '#b8ff9a' : '#ffd9a0', depth: 3 }), w - 196);
      const p = priceOf(o.price);
      if (o.bought) {
        button(this, this.buttons, { x: x + w - 104, y: ry + 26, w: 88, h: 34, label: 'REÇU', icon: 'check', iconSize: 18, size: 12, color: 'gray', enabled: false });
      } else {
        button(this, this.buttons, {
          id: `offer-${o.id}`,
          x: x + w - 104,
          y: ry + 26,
          w: 88,
          h: 34,
          label: p.label,
          suffix: p.suffix,
          suffixSize: 20,
          size: o.free ? 12 : 15,
          color: o.free ? 'green' : 'yellow',
          enabled: profile.canAfford(o.price),
          sound: 'buy',
          onDenied: () => toast(this, missing(o.price), '#ff9aa5'),
          onTap: () => this.showReward(profile.buyOffer(o.id), { x: x + 44, y: ry + 43 }, () => this.reload()),
        });
      }
    });
  }

  // ── Coffres ────────────────────────────────────────────────

  drawChests() {
    const x0 = 320;
    const cw = 164;
    const gap = 9;
    const y = 58;
    const hues = { eveil: 0x8a5626, maree: 0x2a62a8, fusion: 0x5f2aa8 };
    Object.values(CHESTS).forEach((def, i) => {
      const x = x0 + i * (cw + gap);
      panel(this, x, y, cw, 320, { fill: 0x18204a, header: hues[def.id], headerH: 30 });
      fitWidth(addText(this, x + cw / 2, y + 15, def.name.toUpperCase(), { size: 12.5, ox: 0.5, oy: 0.5, depth: 2 }), cw - 14);
      // Lumière + coffre qui flotte
      this.add.image(x + cw / 2, y + 126, 'rays').setTint(0xffffff).setAlpha(0.1).setDisplaySize(230, 230).setBlendMode('ADD').setDepth(1);
      const img = icon(this, `chest_${def.id}`, x + cw / 2, y + 126, 118, 3);
      this.tweens.add({ targets: img, y: img.y - 6, duration: 1000 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: img, angle: { from: -2.5, to: 2.5 }, duration: 1500 + i * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      addText(this, x + cw / 2, y + 204, `${def.rolls} récompenses`, { size: 14, ox: 0.5, oy: 0.5, color: '#ffe27a', depth: 2 });
      addText(this, x + cw / 2, y + 232, `Pièces ${def.coins[0]}–${def.coins[1]}\nGemmes · XP`, {
        size: 10.5,
        ox: 0.5,
        oy: 0.5,
        align: 'center',
        color: '#c9d3ee',
        bold: false,
        depth: 2,
      });
      const p = priceOf(def.price);
      button(this, this.buttons, {
        id: `chest-${def.id}`,
        x: x + 14,
        y: y + 264,
        w: cw - 28,
        h: 40,
        label: p.label,
        suffix: p.suffix,
        suffixSize: 24,
        size: 18,
        color: 'yellow',
        enabled: profile.canAfford(def.price),
        sound: 'buy',
        onDenied: () => toast(this, missing(def.price), '#ff9aa5'),
        onTap: () => this.showReward(profile.buyChest(def.id), { x: x + cw / 2, y: y + 126 }, () => this.reload()),
      });
    });
  }
}
