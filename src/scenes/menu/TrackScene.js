// ─────────────────────────────────────────────────────────────
//  TrackScene — une barre de paliers à débloquer, utilisée deux fois :
//   • kind 'pass' : le PASS DE SAISON (paliers gratuits, points gagnés en jouant)
//   • kind 'road' : la VOIE DES CRISTAUX (paliers de trophées)
// ─────────────────────────────────────────────────────────────
import { META, PASS } from '../../config/meta.js';
import { profile } from '../../meta/profile.js';
import { INK, REF_W, bar, button, fmt, icon, panel, rewardFrame, rewardLabel } from '../../ui/kit.js';
import { addText, fitWidth } from '../../ui/theme.js';
import { MenuBase } from './MenuBase.js';

export class TrackScene extends MenuBase {
  constructor() {
    super('Track');
  }

  create() {
    this.begin();
    const road = this.sceneData.kind === 'road';
    this.road = road;
    const items = road
      ? profile.roadState().map((r) => ({ ...r, need: r.at }))
      : profile.passState();
    const value = road ? profile.data.bestTrophies : profile.data.passPoints;

    this.drawBackdrop(road ? 'foudre' : 'vent', { rays: 0.1 });
    this.drawHeader(road ? 'VOIE DES CRISTAUX' : 'PASS DE SAISON', road ? 'Gagne des trophées pour débloquer les paliers' : PASS.name);
    this.drawCurrencies();
    this.drawSummary(items, value);
    this.drawTrack(items, value);
  }

  /** Bandeau du haut : où j'en suis, et comment progresser. */
  drawSummary(items, value) {
    const road = this.road;
    const x = 14;
    const y = 58;
    const w = REF_W - 28;
    panel(this, x, y, w, 50, { fill: 0x18204a });
    const next = items.find((it) => it.state === 'locked');
    const prev = [...items].reverse().find((it) => value >= it.need);
    icon(this, road ? 'trophy' : 'season', x + 28, y + 25, 36, 3);
    addText(this, x + 54, y + 16, road ? `${fmt(profile.totalTrophies)} trophées` : `${fmt(value)} points de saison`, { size: 16, oy: 0.5, color: road ? '#ffe27a' : '#e3c8ff', depth: 2 });
    const m = META.match;
    const how = road
      ? `Victoire +${m.win.trophies} · défaite ${m.lose.trophies} · un palier atteint reste acquis (record : ${fmt(value)})`
      : `Victoire +${m.win.pass} points · défaite +${m.lose.pass} · égalité +${m.draw.pass}`;
    fitWidth(addText(this, x + 54, y + 35, how, { size: 10.5, oy: 0.5, color: '#c9d3ee', bold: false, depth: 2 }), 430);
    if (next) {
      const from = prev ? prev.need : 0;
      bar(this, x + w - 300, y + 14, 200, 12, (value - from) / (next.need - from), road ? 0xffc21f : 0xb06cff, { depth: 2 });
      addText(this, x + w - 200, y + 20, `${fmt(value)} / ${fmt(next.need)}`, { size: 9.5, ox: 0.5, oy: 0.5, depth: 3, stroke: '#0a0d18', strokeW: 3 });
      addText(this, x + w - 200, y + 37, 'Prochain palier', { size: 9.5, ox: 0.5, oy: 0.5, color: '#c9d3ee', bold: false, depth: 2 });
      icon(this, rewardFrame(next.reward), x + w - 62, y + 22, next.reward.chest ? 46 : 32, 3);
      addText(this, x + w - 62, y + 42, rewardLabel(next.reward), { size: 9.5, ox: 0.5, oy: 0.5, depth: 3, stroke: '#0a0d18', strokeW: 3 });
    } else {
      addText(this, x + w - 20, y + 25, 'Tous les paliers sont débloqués !', { size: 13, ox: 1, oy: 0.5, color: '#b8ff9a', depth: 2 });
    }
  }

  drawTrack(items, value) {
    const road = this.road;
    const n = items.length;
    const x0 = 62;
    const x1 = REF_W - 62;
    const step = (x1 - x0) / (n - 1);
    const lineY = 262;
    const color = road ? 0xffc21f : 0xb06cff;
    panel(this, 14, 120, REF_W - 28, 256, { fill: 0x141b3e });

    // Position sur la barre d'une valeur (interpolation entre deux paliers)
    const xOf = (v) => {
      let px = x0 - step * 0.6;
      let pv = 0;
      for (let i = 0; i < n; i++) {
        const nx = x0 + i * step;
        if (v <= items[i].need) return px + ((v - pv) / (items[i].need - pv)) * (nx - px);
        px = nx;
        pv = items[i].need;
      }
      return x1 + 10;
    };

    // Rail + remplissage
    const g = this.add.graphics().setDepth(2);
    const startX = x0 - step * 0.6;
    g.fillStyle(INK, 1);
    g.fillRoundedRect(startX - 3, lineY - 9, x1 - startX + 16, 18, 9);
    g.fillStyle(0x0b1028, 1);
    g.fillRoundedRect(startX, lineY - 6, x1 - startX + 10, 12, 6);
    const fillTo = Math.max(startX + 8, xOf(value));
    g.fillStyle(color, 1);
    g.fillRoundedRect(startX, lineY - 6, fillTo - startX, 12, 6);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(startX + 3, lineY - 4.5, Math.max(2, fillTo - startX - 6), 3.5, 2);

    const cw = Math.min(62, step - 6);
    items.forEach((it, i) => {
      const x = x0 + i * step;
      const ready = it.state === 'ready';
      const claimed = it.state === 'claimed';
      // Carte de récompense
      const cy = 138;
      const ch = 92;
      panel(this, x - cw / 2, cy, cw, ch, {
        fill: ready ? 0x3a4a1f : claimed ? 0x1a2238 : 0x222c5a,
        radius: 12,
        shadow: false,
        depth: 3,
      });
      if (ready) {
        const glow = this.add.graphics().setDepth(3.5);
        glow.lineStyle(3, 0xb8ff9a, 1);
        glow.strokeRoundedRect(x - cw / 2 + 1, cy + 1, cw - 2, ch - 2, 11);
        this.tweens.add({ targets: glow, alpha: 0.35, duration: 520, yoyo: true, repeat: -1 });
      }
      const img = icon(this, rewardFrame(it.reward), x, cy + 36, it.reward.chest ? Math.min(58, cw) : 38, 4);
      if (claimed) img.setAlpha(0.3);
      else if (ready) this.tweens.add({ targets: img, y: img.y - 4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      fitWidth(
        addText(this, x, cy + 74, rewardLabel(it.reward), { size: 11.5, ox: 0.5, oy: 0.5, depth: 4, stroke: '#0a0d18', strokeW: 3, color: claimed ? '#7f8aae' : '#ffffff' }),
        cw - 6,
      );
      if (claimed) icon(this, 'check', x, cy + 36, 30, 5);
      else if (it.state === 'locked') icon(this, 'lock', x + cw / 2 - 9, cy + 10, 18, 5);

      // Jalon sur le rail
      const node = this.add.graphics().setDepth(4);
      node.fillStyle(INK, 1);
      node.fillCircle(x, lineY, 14);
      node.fillStyle(claimed || ready ? color : 0x39446e, 1);
      node.fillCircle(x, lineY, 11);
      node.fillStyle(0xffffff, 0.35);
      node.fillCircle(x - 3, lineY - 3.5, 3.5);
      addText(this, x, lineY, String(i + 1), { size: 11, ox: 0.5, oy: 0.5, depth: 5, stroke: '#0a0d18', strokeW: 3 });
      // Trait vers la carte
      g.lineStyle(3, INK, 0.8);
      g.lineBetween(x, cy + ch + 3, x, lineY - 14);
      // Seuil
      addText(this, x, lineY + 25, fmt(it.need), { size: 10.5, ox: 0.5, oy: 0.5, depth: 4, color: claimed || ready ? '#ffffff' : '#93a0c4' });

      if (ready) {
        button(this, this.buttons, {
          id: `claim-${it.index}`,
          x: x - Math.min(cw, 60) / 2,
          y: lineY + 40,
          w: Math.min(cw, 60),
          h: 26,
          label: 'OK !',
          size: 12.5,
          color: 'green',
          sound: 'reward',
          onTap: () => this.claim(it.index, { x, y: cy + 36 }),
        });
        // Toucher la carte marche aussi
        this.buttons.add({ x: x - cw / 2, y: cy, w: cw, h: ch, sound: 'reward', onTap: () => this.claim(it.index, { x, y: cy + 36 }) });
      }
    });
    addText(this, REF_W / 2, 362, road ? 'trophées (meilleur total atteint)' : `points de saison · ${PASS.perTier} points par palier`, {
      size: 9.5,
      ox: 0.5,
      oy: 0.5,
      color: '#7f8aae',
      bold: false,
      depth: 4,
    });
  }

  claim(index, from) {
    const out = this.road ? profile.claimRoad(index) : profile.claimPass(index);
    this.showReward(out, from, () => this.scene.restart({ kind: this.sceneData.kind, slide: 0 }));
  }
}
