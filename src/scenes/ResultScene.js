// ─────────────────────────────────────────────────────────────
//  ResultScene — fin de match : victoire / défaite / égalité, puis les
//  récompenses qui s'animent une à une (trophées gagnés ou perdus, pièces,
//  XP et niveau, points de saison, Voie des Cristaux), le tableau des
//  scores, et retour au menu.
//
//  Les récompenses sont déjà enregistrées par GameScene au moment où le
//  match se termine : cet écran ne fait que les montrer.
// ─────────────────────────────────────────────────────────────
import { sfx } from '../audio/Sfx.js';
import { CHARACTERS } from '../config/characters.js';
import { CRYSTAL } from '../config/constants.js';
import { ELEMENTS, TEAM_COLORS } from '../config/elements.js';
import { profile } from '../meta/profile.js';
import { REF_W, bar, button, countUp, fmt, icon, panel, rewardFrame, rewardLabel } from '../ui/kit.js';
import { addText, fitWidth, hex } from '../ui/theme.js';
import { MenuBase, RIG_ANIM } from './menu/MenuBase.js';

export class ResultScene extends MenuBase {
  constructor() {
    super('Result');
  }

  create() {
    this.begin();
    const { outcome, result, fighters, rewards } = this.sceneData;
    const win = outcome === 'win';
    const draw = outcome === 'draw';
    const me = fighters.find((f) => f.isPlayer) || fighters[0];
    const playerTeam = me.team;
    const accent = draw ? 0xffffff : win ? 0xffd24a : 0xff5a6a;

    this.drawBackdrop(win ? 'foudre' : draw ? 'vent' : 'eau', { cx: 124, cy: 210, rays: win ? 0.22 : 0.08 });

    // ── Titre ──
    const title = addText(this, REF_W / 2, 30, draw ? 'ÉGALITÉ' : win ? 'VICTOIRE !' : 'DÉFAITE', {
      size: 44,
      ox: 0.5,
      oy: 0.5,
      color: hex(accent),
      stroke: '#05070f',
      strokeW: 9,
    });
    title.setScale(0.3);
    this.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.easeOut' });
    fitWidth(addText(this, REF_W / 2, 64, this.reasonText(result, playerTeam), { size: 13, ox: 0.5, oy: 0.5, color: '#e6ecff', stroke: '#05070f', strokeW: 4 }), 560);

    // ── Mon personnage ──
    const def = CHARACTERS[me.charId];
    const el = ELEMENTS[def.element];
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(124, 262, 168, 34);
    g.fillStyle(el.color, 0.55);
    g.fillEllipse(124, 257, 176, 36);
    const r = this.addRig(me.charId, 124, 204, 2, win ? RIG_ANIM.happy : RIG_ANIM.sad);
    r.jump = 14;
    fitWidth(addText(this, 124, 292, def.name.toUpperCase(), { size: 18, ox: 0.5, oy: 0.5, stroke: '#05070f', strokeW: 5 }), 200);
    if (win) {
      this.add
        .particles(0, 0, 'fx', {
          frame: 'confetti',
          x: { min: 0, max: REF_W },
          y: -20,
          lifespan: 4200,
          speedY: { min: 90, max: 190 },
          speedX: { min: -40, max: 40 },
          rotate: { start: 0, end: 540 },
          scale: { min: 0.35, max: 0.6 },
          tint: [0xff5533, 0x2f9bff, 0xffd400, 0x52e0b8, 0xffffff, 0xff7bf0],
          frequency: 60,
          advance: 1200,
        })
        .setDepth(40);
    }

    this.drawRewards(rewards, 246, 84, 318);
    this.drawScores(result, fighters, playerTeam, 576, 84, 254);

    // ── Boutons ──
    button(this, this.buttons, {
      id: 'continue',
      x: 246,
      y: 334,
      w: 318,
      h: 42,
      label: 'CONTINUER',
      size: 21,
      strokeW: 5,
      color: 'yellow',
      onTap: () => this.go('Home', {}, -1),
    });
    button(this, this.buttons, {
      id: 'replay',
      x: 576,
      y: 336,
      w: 254,
      h: 38,
      label: 'REJOUER',
      size: 17,
      color: 'blue',
      sound: 'play',
      onTap: () => {
        if (this.leaving) return;
        this.leaving = true;
        this.buttons.enabled = false;
        this.cameras.main.fadeOut(200, 8, 12, 28);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('Game', { charId: this.sceneData.charId, difficulty: this.sceneData.difficulty }),
        );
      },
    });
  }

  reasonText(result, playerTeam) {
    const mine = result.crystals[playerTeam];
    const theirs = result.crystals[1 - playerTeam];
    switch (result.reason) {
      case 'hold':
        return result.winner === playerTeam
          ? `Votre équipe a gardé les ${CRYSTAL.count} cristaux pendant ${CRYSTAL.holdToWin} s !`
          : `L’équipe adverse a gardé les ${CRYSTAL.count} cristaux pendant ${CRYSTAL.holdToWin} s.`;
      case 'crystals':
        return `Temps écoulé — cristaux : ${mine} contre ${theirs}`;
      case 'kills':
        return `Temps écoulé, cristaux à égalité — éliminations : ${result.kills[playerTeam]} contre ${result.kills[1 - playerTeam]}`;
      default:
        return 'Temps écoulé — égalité parfaite !';
    }
  }

  // ── Récompenses animées ────────────────────────────────────

  drawRewards(rw, x, y, w) {
    panel(this, x, y, w, 238, { fill: 0x18204a, header: 0x2a3a7a, headerH: 26 });
    addText(this, x + 12, y + 13, 'RÉCOMPENSES', { size: 12.5, oy: 0.5, color: '#9fc6ff', depth: 2 });
    if (!rw) return;
    const rows = [];
    const rowY = (i) => y + 50 + i * 40;
    const reveal = (objs, delay, sound) => {
      for (const o of objs) {
        const a = o.alpha;
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: a, delay, duration: 180 });
      }
      this.time.delayedCall(delay, () => sfx.play(sound));
    };

    // 1. Trophées
    {
      const yy = rowY(0);
      const ic = icon(this, 'trophy', x + 30, yy, 38, 3);
      const label = addText(this, x + 58, yy - 8, 'Trophées', { size: 11, oy: 0.5, color: '#c9d3ee', bold: false, depth: 3 });
      const val = addText(this, x + 58, yy + 8, fmt(rw.trophies.before), { size: 19, oy: 0.5, color: '#ffe27a', depth: 3 });
      const d = rw.trophies.delta;
      const delta = addText(this, x + w - 16, yy, d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '+0', {
        size: 24,
        ox: 1,
        oy: 0.5,
        color: d > 0 ? '#b8ff9a' : d < 0 ? '#ff8f9a' : '#c9d3ee',
        stroke: '#0a0d18',
        strokeW: 5,
        depth: 3,
      });
      rows.push({ objs: [ic, label, val, delta], sound: d >= 0 ? 'trophy' : 'deny', after: () => {
        countUp(this, val, rw.trophies.before, rw.trophies.after, 700);
        this.tweens.add({ targets: delta, scale: 1.35, duration: 140, yoyo: true });
        this.tweens.add({ targets: ic, angle: { from: -14, to: 14 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => ic.setAngle(0) });
      } });
    }
    // 2. Pièces
    {
      const yy = rowY(1);
      const ic = icon(this, 'coin', x + 30, yy, 36, 3);
      const label = addText(this, x + 58, yy - 8, 'Pièces', { size: 11, oy: 0.5, color: '#c9d3ee', bold: false, depth: 3 });
      const val = addText(this, x + 58, yy + 8, fmt(rw.coins.before), { size: 19, oy: 0.5, depth: 3 });
      const delta = addText(this, x + w - 16, yy, `+${rw.coins.delta}`, { size: 24, ox: 1, oy: 0.5, color: '#ffe27a', stroke: '#0a0d18', strokeW: 5, depth: 3 });
      rows.push({ objs: [ic, label, val, delta], sound: 'coins', after: () => {
        countUp(this, val, rw.coins.before, rw.coins.after, 700);
        this.tweens.add({ targets: delta, scale: 1.3, duration: 140, yoyo: true });
      } });
    }
    // 3. XP et niveau
    {
      const yy = rowY(2);
      const ic = icon(this, 'xp', x + 30, yy, 36, 3);
      const label = addText(this, x + 58, yy - 9, `Niveau ${rw.level.before}`, { size: 11, oy: 0.5, color: '#c9d3ee', bold: false, depth: 3 });
      const b = bar(this, x + 58, yy + 1, w - 150, 11, rw.xp.before / rw.xp.neededBefore, 0x4db4ff, { depth: 3 });
      const delta = addText(this, x + w - 16, yy, `+${rw.xp.gained} XP`, { size: 16, ox: 1, oy: 0.5, color: '#9fe0ff', stroke: '#0a0d18', strokeW: 4, depth: 3 });
      rows.push({ objs: [ic, label, b.g, delta], sound: 'tick', after: () => {
        const ups = rw.level.ups.length;
        const state = { p: rw.xp.before / rw.xp.neededBefore };
        const fill = (to, onDone) => this.tweens.add({ targets: state, p: to, duration: 520, ease: 'Cubic.easeOut', onUpdate: () => b.set(state.p), onComplete: onDone });
        if (ups === 0) fill(rw.xp.after / rw.xp.neededAfter);
        else {
          // La barre se remplit, « NIVEAU SUPÉRIEUR », puis repart du début
          fill(1, () => {
            sfx.play('upgrade');
            label.setText(`Niveau ${rw.level.after} !`).setColor('#b8ff9a');
            this.tweens.add({ targets: [ic, label], scale: '*=1.3', duration: 150, yoyo: true });
            const up = rw.level.ups[ups - 1];
            delta.setText(`+${up.coins * ups}  pièces  +${up.gems * ups}  gemmes`).setFontSize(11).setColor('#b8ff9a');
            state.p = 0;
            fill(rw.xp.after / rw.xp.neededAfter);
          });
        }
      } });
    }
    // 4. Points de saison
    {
      const yy = rowY(3);
      const ic = icon(this, 'season', x + 30, yy, 34, 3);
      const label = addText(this, x + 58, yy - 8, 'Pass de saison', { size: 11, oy: 0.5, color: '#c9d3ee', bold: false, depth: 3 });
      const val = addText(this, x + 58, yy + 8, `${fmt(rw.pass.after)} points`, { size: 15, oy: 0.5, depth: 3, color: '#e3c8ff' });
      const delta = addText(this, x + w - 16, yy, `+${rw.pass.delta}`, { size: 20, ox: 1, oy: 0.5, color: '#e3c8ff', stroke: '#0a0d18', strokeW: 5, depth: 3 });
      rows.push({ objs: [ic, label, val, delta], sound: 'tick' });
    }
    // 5. Voie des Cristaux
    {
      const yy = rowY(4) + 2;
      const { next, prevAt, best } = profile.roadProgress();
      const objs = [];
      const reached = rw.roadReached.length > 0;
      objs.push(addText(this, x + 14, yy - 11, reached ? 'PALIER ATTEINT SUR LA VOIE DES CRISTAUX !' : 'Voie des Cristaux', {
        size: reached ? 11.5 : 10.5,
        oy: 0.5,
        color: reached ? '#b8ff9a' : '#7df9ff',
        depth: 3,
      }));
      if (next) {
        const b = bar(this, x + 14, yy + 1, w - 86, 11, Math.max(0, (best - prevAt) / (next.at - prevAt)), 0xffc21f, { depth: 3 });
        const record = best !== profile.totalTrophies ? 'Record ' : '';
        objs.push(b.g, addText(this, x + 14 + (w - 86) / 2, yy + 6.5, `${record}${fmt(best)} / ${fmt(next.at)}`, { size: 9, ox: 0.5, oy: 0.5, depth: 4, stroke: '#0a0d18', strokeW: 3 }));
        objs.push(icon(this, rewardFrame(next.reward), x + w - 36, yy - 1, next.reward.chest ? 42 : 30, 4));
        objs.push(addText(this, x + w - 36, yy + 17, rewardLabel(next.reward), { size: 9, ox: 0.5, oy: 0.5, depth: 4, stroke: '#0a0d18', strokeW: 3 }));
      } else {
        objs.push(addText(this, x + 14, yy + 7, 'Tous les paliers sont atteints !', { size: 11, oy: 0.5, depth: 3 }));
      }
      rows.push({ objs, sound: reached ? 'reward-big' : 'tick' });
    }

    rows.forEach((row, i) => {
      const delay = 500 + i * 420;
      reveal(row.objs, delay, row.sound);
      if (row.after) this.time.delayedCall(delay + 120, row.after);
    });
  }

  // ── Tableau des scores ─────────────────────────────────────

  drawScores(result, fighters, playerTeam, x, y, w) {
    panel(this, x, y, w, 238, { fill: 0x18204a });
    const best = Math.max(...fighters.map((f) => f.damage));
    [playerTeam, 1 - playerTeam].forEach((team, k) => {
      const col = TEAM_COLORS[team];
      const ty = y + 6 + k * 116;
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(col.dark, 1);
      g.fillRoundedRect(x + 6, ty, w - 12, 22, 9);
      addText(this, x + 16, ty + 11, k === 0 ? 'VOTRE ÉQUIPE' : 'ADVERSAIRES', { size: 11, oy: 0.5, depth: 3 });
      addText(this, x + w - 14, ty + 11, `${result.crystals[team]} crist. · ${result.kills[team]} élim.`, { size: 10, ox: 1, oy: 0.5, color: hex(col.light), depth: 3 });
      fighters
        .filter((f) => f.team === team)
        .forEach((f, i) => {
          const fy = ty + 38 + i * 27;
          if (f.isPlayer) {
            g.fillStyle(0xffffff, 0.09);
            g.fillRoundedRect(x + 6, fy - 12, w - 12, 25, 8);
          }
          this.add.image(x + 24, fy + 1, `char_${f.charId}`, 'head').setScale(0.085).setDepth(3);
          for (const s of [-1, 1]) this.add.image(x + 24 + s * 2.65 + 0.2, fy + 3.5, `char_${f.charId}`, 'pupil').setScale(0.085).setDepth(3.1);
          fitWidth(addText(this, x + 44, fy, CHARACTERS[f.charId].name + (f.isPlayer ? ' (toi)' : ''), { size: 12.5, oy: 0.5, depth: 3 }), 96);
          addText(this, x + w - 96, fy, `${f.kills} élim.`, { size: 10.5, ox: 0.5, oy: 0.5, depth: 3, color: '#c9d3ee' });
          addText(this, x + w - 16, fy, fmt(f.damage), { size: 12, ox: 1, oy: 0.5, depth: 3, color: f.damage === best && best > 0 ? '#ffe27a' : '#ffffff' });
        });
    });
  }
}
