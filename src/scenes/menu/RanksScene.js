// ─────────────────────────────────────────────────────────────
//  RanksScene — le classement.
//  Pour l'instant LOCAL : des joueurs fictifs, et toi classé selon tes
//  trophées. Le vrai classement en ligne viendra avec le multijoueur.
// ─────────────────────────────────────────────────────────────
import { profile } from '../../meta/profile.js';
import { INK, REF_W, fmt, icon, panel } from '../../ui/kit.js';
import { addText, fitWidth } from '../../ui/theme.js';
import { MenuBase } from './MenuBase.js';

const MEDALS = [0xffd24a, 0xc9cfe0, 0xe0a070];

export class RanksScene extends MenuBase {
  constructor() {
    super('Ranks');
  }

  create() {
    this.begin();
    this.drawBackdrop('eau', { rays: 0.1 });
    this.drawHeader('CLASSEMENT', 'Joueurs fictifs pour l’instant — le classement en ligne viendra avec le multijoueur');
    this.drawCurrencies();

    const rows = profile.leaderboard();
    const me = rows.find((r) => r.me);
    // Les 7 premiers, puis ma ligne si je n'y suis pas
    const shown = rows.slice(0, 7);
    const alone = !shown.includes(me);
    const x = 120;
    const w = REF_W - 240;
    const y0 = 60;
    panel(this, x - 10, y0 - 4, w + 20, 322, { fill: 0x141b3e });
    const draw = (r, y) => {
      panel(this, x, y, w, 32, { fill: r.me ? 0x2f5a2a : 0x202a58, radius: 11, shadow: false, depth: 2 });
      // Rang (médaille pour le podium)
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(INK, 1);
      g.fillCircle(x + 24, y + 16, 14);
      g.fillStyle(r.rank <= 3 ? MEDALS[r.rank - 1] : 0x39446e, 1);
      g.fillCircle(x + 24, y + 16, 11.5);
      addText(this, x + 24, y + 16, String(r.rank), { size: 12, ox: 0.5, oy: 0.5, depth: 4, stroke: '#0a0d18', strokeW: 3 });
      // Avatar : tête du personnage favori
      this.add.image(x + 62, y + 17, `char_${r.charId}`, 'head').setScale(0.1).setDepth(3);
      for (const s of [-1, 1]) this.add.image(x + 62 + s * 3.1 + 0.3, y + 20, `char_${r.charId}`, 'pupil').setScale(0.1).setDepth(3.1);
      fitWidth(addText(this, x + 88, y + 16, r.me ? `${r.name} (toi)` : r.name, { size: 14.5, oy: 0.5, depth: 3, color: r.me ? '#d9ffcf' : '#ffffff' }), w - 280);
      addText(this, x + w - 170, y + 16, `Niv. ${r.level}`, { size: 11.5, oy: 0.5, depth: 3, color: '#9fc6ff' });
      icon(this, 'trophy', x + w - 84, y + 16, 24, 3);
      addText(this, x + w - 68, y + 16, fmt(r.trophies), { size: 15, oy: 0.5, depth: 3, color: '#ffe27a' });
    };
    shown.forEach((r, i) => draw(r, y0 + 4 + i * 37));
    if (alone) {
      addText(this, REF_W / 2, y0 + 4 + 7 * 37 + 2, '· · ·', { size: 16, ox: 0.5, oy: 0.5, color: '#93a0c4', depth: 3 });
      draw(me, y0 + 4 + 7 * 37 + 14);
    }
  }
}
