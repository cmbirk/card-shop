import type { Card, Sport } from '@shared/types';
import { mulberry32 } from '../../systems/rng';

// All drawing is deterministic from card.seed — same art every reload.

const SPORT_HUES: Record<Sport, number> = {
  baseball: 215,
  basketball: 20,
  football: 140,
  hockey: 200,
  tcg: 275,
};

export function teamColors(card: Card): { main: string; dark: string; accent: string } {
  const rand = mulberry32(card.seed);
  const hue = (SPORT_HUES[card.sport] + Math.floor(rand() * 50) - 25 + 360) % 360;
  return {
    main: `hsl(${hue}, 55%, 42%)`,
    dark: `hsl(${hue}, 60%, 24%)`,
    accent: `hsl(${(hue + 40) % 360}, 70%, 60%)`,
  };
}

function borderColor(card: Card): string {
  switch (card.rarity) {
    case 'graded':
      return '#f5f5f0';
    case 'premium':
      return '#c9a227'; // gold
    case 'rare':
      return '#b9bec6'; // silver
    default:
      return '#efe6c8'; // aged cream
  }
}

function drawStarburst(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rand: () => number) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#ffffff';
  const rays = 14 + Math.floor(rand() * 8);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rand() * 0.1;
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

/** Stylized player silhouette, one pose per sport. Drawn in a 100x100 box centered at (cx, cy). */
function drawSilhouette(ctx: CanvasRenderingContext2D, sport: Sport, cx: number, cy: number, s: number, rand: () => number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 100, s / 100);
  const flip = rand() > 0.5 ? -1 : 1;
  ctx.scale(flip, 1);
  ctx.fillStyle = 'rgba(12, 18, 34, 0.92)';
  ctx.strokeStyle = 'rgba(12, 18, 34, 0.92)';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';

  const head = (x: number, y: number, r = 9) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  switch (sport) {
    case 'baseball': // batter mid-swing
      head(-8, -34);
      line(-8, -24, 2, 6); // torso lean
      line(2, 6, -10, 34); // back leg
      line(2, 6, 18, 30); // front leg
      line(-6, -18, 14, -26); // arms to bat
      ctx.lineWidth = 6;
      line(14, -26, 40, -44); // bat
      break;
    case 'basketball': // jump shot
      head(0, -38);
      line(0, -28, 0, 2);
      line(0, 2, -12, 32);
      line(0, 2, 12, 28);
      line(0, -22, 16, -40); // shooting arm up
      line(0, -20, -14, -30);
      ctx.beginPath();
      ctx.arc(22, -48, 7, 0, Math.PI * 2); // ball
      ctx.fill();
      break;
    case 'football': // QB throw
      head(-4, -36);
      line(-4, -26, 4, 4);
      line(4, 4, -8, 34);
      line(4, 4, 18, 32);
      line(-2, -20, 22, -34); // throwing arm
      ctx.save();
      ctx.translate(28, -38);
      ctx.rotate(0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); // ball
      ctx.fill();
      ctx.restore();
      break;
    case 'hockey': // skater with stick
      head(-6, -30);
      line(-6, -20, 6, 8);
      line(6, 8, -8, 32);
      line(6, 8, 22, 26);
      line(-4, -14, 18, 0); // arms down to stick
      ctx.lineWidth = 5;
      line(18, 0, 34, 30); // stick
      line(34, 30, 44, 28); // blade
      break;
    case 'tcg': {
      // crested creature: shield + horns + eye
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.quadraticCurveTo(34, -30, 28, 8);
      ctx.quadraticCurveTo(22, 36, 0, 44);
      ctx.quadraticCurveTo(-22, 36, -28, 8);
      ctx.quadraticCurveTo(-34, -30, 0, -42);
      ctx.fill();
      ctx.lineWidth = 6;
      line(-16, -38, -30, -54); // horns
      line(16, -38, 30, -54);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(0, -4, 8, 0, Math.PI * 2); // eye
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** Draw a card front into ctx at (x, y, w, h). Nominal design space 256x358, scales with w. */
export function drawCardFront(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number, w: number, h: number) {
  const rand = mulberry32(card.seed);
  const colors = teamColors(card);
  const u = w / 256; // design unit

  ctx.save();
  ctx.translate(x, y);

  // border frame
  ctx.fillStyle = borderColor(card);
  ctx.fillRect(0, 0, w, h);
  const m = 10 * u; // frame margin
  const iw = w - m * 2;

  // graded cards: slab-style label header above the inner card
  let top = m;
  if (card.grade) {
    const labelH = 44 * u;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(m, m, iw, labelH);
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(m, m, 6 * u, labelH);
    ctx.fillStyle = '#111';
    ctx.font = `bold ${15 * u}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(card.grade.company, m + 12 * u, m + 5 * u);
    ctx.font = `bold ${18 * u}px system-ui, sans-serif`;
    ctx.fillText(card.grade.label.replace(`${card.grade.company} `, ''), m + 12 * u, m + 22 * u);
    ctx.textAlign = 'right';
    ctx.font = `bold ${26 * u}px system-ui, sans-serif`;
    ctx.fillText(String(card.grade.value), m + iw - 8 * u, m + 9 * u);
    ctx.textAlign = 'left';
    top = m + labelH + 4 * u;
  }

  const ih = h - top - m;

  // photo area
  const photoH = ih * 0.62;
  const grad = ctx.createLinearGradient(0, top, 0, top + photoH);
  grad.addColorStop(0, colors.main);
  grad.addColorStop(1, colors.dark);
  ctx.fillStyle = grad;
  ctx.fillRect(m, top, iw, photoH);
  drawStarburst(ctx, m + iw / 2, top + photoH * 0.55, iw * 0.75, rand);
  drawSilhouette(ctx, card.sport, m + iw / 2, top + photoH * 0.52, photoH * 0.85, rand);

  // halftone dots along the bottom of the photo
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffffff';
  for (let dx = 0; dx < iw; dx += 8 * u) {
    for (let dy = 0; dy < 20 * u; dy += 8 * u) {
      ctx.beginPath();
      ctx.arc(m + dx + 4 * u, top + photoH - dy - 4 * u, 1.6 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // name banner
  const bannerY = top + photoH;
  const bannerH = 34 * u;
  ctx.fillStyle = colors.dark;
  ctx.fillRect(m, bannerY, iw, bannerH);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(m, bannerY, iw, 3 * u);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${16 * u}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  let name = card.playerName.toUpperCase();
  while (ctx.measureText(name).width > iw - 12 * u && name.length > 4) name = name.slice(0, -2) + '…';
  ctx.fillText(name, m + 6 * u, bannerY + bannerH / 2 + 1 * u);

  // footer: team / year / set
  const footY = bannerY + bannerH;
  const footH = top + ih - footY;
  ctx.fillStyle = '#f7f1e2';
  ctx.fillRect(m, footY, iw, footH);
  ctx.fillStyle = '#333';
  ctx.font = `${11 * u}px system-ui, sans-serif`;
  ctx.fillText(card.team, m + 6 * u, footY + footH * 0.32);
  ctx.fillStyle = '#666';
  ctx.font = `${10 * u}px system-ui, sans-serif`;
  ctx.fillText(`${card.year} ${card.setName} ${card.cardNumber}`, m + 6 * u, footY + footH * 0.7);

  // premium foil sheen hint baked in (subtle diagonal)
  if (card.foil) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, '#ff5e5e');
    sheen.addColorStop(0.33, '#ffe45e');
    sheen.addColorStop(0.66, '#5eff8f');
    sheen.addColorStop(1, '#5e8fff');
    ctx.fillStyle = sheen;
    ctx.fillRect(m, top, iw, photoH);
    ctx.restore();
  }

  ctx.restore();
}

/** Card back. `withStats` = per-card seeded stat table (used for the hi-res inspect texture). */
export function drawCardBack(
  ctx: CanvasRenderingContext2D,
  sport: Sport,
  x: number,
  y: number,
  w: number,
  h: number,
  card?: Card,
) {
  const u = w / 256;
  const rand = mulberry32(card ? card.seed + 7 : SPORT_HUES[sport]);
  const hue = SPORT_HUES[sport];
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#efe6c8';
  ctx.fillRect(0, 0, w, h);
  const m = 12 * u;
  ctx.strokeStyle = `hsl(${hue}, 45%, 35%)`;
  ctx.lineWidth = 3 * u;
  ctx.strokeRect(m, m, w - m * 2, h - m * 2);

  // logo mark
  ctx.fillStyle = `hsl(${hue}, 50%, 38%)`;
  ctx.beginPath();
  ctx.arc(w / 2, 64 * u, 28 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#efe6c8';
  ctx.font = `bold ${22 * u}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sport === 'tcg' ? '✦' : sport[0].toUpperCase(), w / 2, 65 * u);

  ctx.fillStyle = `hsl(${hue}, 45%, 30%)`;
  ctx.font = `bold ${12 * u}px system-ui, sans-serif`;
  ctx.fillText(sport === 'tcg' ? 'ARCANE LEAGUE' : `${sport.toUpperCase()} ARCHIVE`, w / 2, 104 * u);

  // stat table
  const rows = card ? 6 : 5;
  const tableY = 124 * u;
  const rowH = 20 * u;
  const cols = ['YR', 'GP', 'AVG', 'PTS'];
  ctx.font = `${9 * u}px ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#5a4a32';
  cols.forEach((c, i) => ctx.fillText(c, m + 12 * u + i * 54 * u, tableY));
  ctx.fillStyle = '#3c3222';
  for (let r = 0; r < rows; r++) {
    const yy = tableY + rowH * (r + 1);
    const year = (card ? card.year - rows + r + 1 : 1990 + r).toString();
    const gp = String(40 + Math.floor(rand() * 42));
    const avg = (0.2 + rand() * 0.15).toFixed(3).slice(1);
    const pts = String(Math.floor(rand() * 120));
    [year, gp, avg, pts].forEach((v, i) => ctx.fillText(v, m + 12 * u + i * 54 * u, yy));
    ctx.strokeStyle = 'rgba(90,74,50,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m + 8 * u, yy + 6 * u);
    ctx.lineTo(w - m - 8 * u, yy + 6 * u);
    ctx.stroke();
  }

  // career highlight lines
  ctx.fillStyle = '#5a4a32';
  ctx.font = `italic ${9 * u}px Georgia, serif`;
  const noteY = tableY + rowH * (rows + 1) + 8 * u;
  const notes = card
    ? [`"${card.lore.blurb.split('.')[0]}."`, `${card.setName} · ${card.cardNumber}`]
    : ['Collect the whole set!', 'Printed with pride.'];
  notes.forEach((line, i) => {
    let txt = line;
    ctx.textAlign = 'left';
    while (ctx.measureText(txt).width > w - m * 2 - 16 * u && txt.length > 4) txt = txt.slice(0, -2) + '…';
    ctx.fillText(txt, m + 8 * u, noteY + i * 14 * u);
  });

  ctx.restore();
}
