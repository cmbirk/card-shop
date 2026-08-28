// Deterministic mock inventory generator → shared/data/inventory.json
// Fake players/teams from word lists x seed — obviously fictional, licensing-safe.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(19890716);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const ri = (min, max) => min + Math.floor(rand() * (max - min + 1));

const FIRST = ['Ray', 'Dayton', 'Marcus', 'Elio', 'Tomas', 'Wes', 'Jalen', 'Bo', 'Sterling', 'Nico', 'Harlan', 'Dez', 'Otto', 'Cal', 'Rufus', 'Ike', 'Monty', 'Zeke', 'Ambrose', 'Flip'];
const LAST = ['Callister', 'Vane', 'Okafor-Reyes', 'Strand', 'Bellweather', 'Quill', 'Marsh', 'Ferro', 'Duckworth', 'Pemberton', 'Ashby', 'Cormorant', 'Vex', 'Halloway', 'Brisket', 'Tanager', 'Mollusk', 'Grady', 'Fontaine', 'Slocum'];

const TEAMS = {
  baseball: ['Dayton Comets', 'Harbor City Herons', 'Bluff Creek Badgers', 'Salt Flat Sliders'],
  basketball: ['Ridgeline Rockets', 'Pactown Pulse', 'Iron Valley Vipers', 'Coast Range Cyclones'],
  football: ['Granite Bay Grizzlies', 'Thornfield Thunder', 'Mesa Verde Mustangs', 'Port Alder Pikes'],
  hockey: ['Frostburg Foxes', 'North Bend Narwhals', 'Cedar Rapids Chill', 'Lakemont Lynx'],
  tcg: ['Embermaw Clan', 'Tidecaller Guild', 'Verdant Court', 'Hollow Star Order'],
};
const POSITIONS = {
  baseball: ['SS', 'CF', 'C', '1B', '3B', 'P', 'RF'],
  basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
  football: ['QB', 'RB', 'WR', 'TE', 'LB', 'CB'],
  hockey: ['C', 'LW', 'RW', 'D', 'G'],
  tcg: ['Dragon', 'Mystic', 'Beast', 'Elemental', 'Trickster'],
};
const SETS = {
  baseball: ['Summit', 'Grandstand', 'Pennant Craze', 'Dugout Heroes'],
  basketball: ['Fastbreak', 'Hardwood Elite', 'Rim City', 'Crossover'],
  football: ['Gridiron Vault', 'Red Zone', 'Blitz Premium', 'End Around'],
  hockey: ['Ice Works', 'Blue Line', 'Power Play', 'Frozen Pond'],
  tcg: ['Embers & Omens', 'Tidebound', 'Verdant Rites', 'Hollow Stars'],
};
const NOTES = ['steady riser', 'hype-driven, volatile', 'sleeper pick among collectors', 'blue-chip of this set', 'undervalued right now', 'peaked in the 90s, holding steady'];
const FACTS = [
  'Print runs from this year are notorious for off-center cuts — a well-centered copy is a find.',
  'The photographer caught this shot during a rain delay, which is why the lighting looks moody.',
  'Rumor says a warehouse flood destroyed half this print run.',
  'This set introduced the foil stamp that every kid tried to tilt under the light.',
  'Card shop legend: a mint copy once traded hands for a used lawnmower.',
  'The set designer hid their initials in the border pattern.',
];

function fakePlayer() {
  return `${pick(FIRST)} ${pick(LAST)}`;
}

function blurb(card) {
  const openers = [
    `A standout from the ${card.year} ${card.setName} run.`,
    `One of the more talked-about pulls in ${card.setName}.`,
    `${card.playerName}'s ${card.year} appearance for the ${card.team}.`,
    `A ${card.category === 'vintage' ? 'true vintage piece' : 'collector favorite'} from ${card.year}.`,
  ];
  const closers = {
    rookies: 'Rookie-year cards like this are where collections start.',
    vintage: 'Corners this clean on a card this old are getting hard to find.',
    stars: 'A dependable centerpiece for any team collection.',
    'graded-slabs': 'Professionally graded and sealed — the real deal.',
    'budget-box': 'Nothing fancy, but every binder needs its role players.',
    'budget-box-b': 'A dollar-bin diamond if you squint.',
  };
  return `${pick(openers)} ${closers[card.category] ?? ''}`.trim();
}

let n = 0;
const cards = [];

function addCard({ sport, category, rarity, priceRange, featured, foil, graded }) {
  const playerName = fakePlayer();
  const year = category === 'vintage' ? ri(1958, 1979) : category === 'rookies' ? ri(2018, 2025) : ri(1985, 2015);
  const setName = pick(SETS[sport]);
  const team = pick(TEAMS[sport]);
  const seed = ri(1, 2 ** 31);
  const card = {
    id: `${sport.slice(0, 2)}-${year}-${n++}`,
    sport,
    category,
    playerName,
    team,
    year,
    setName,
    cardNumber: `#${ri(1, 399)}`,
    rarity,
    price: ri(priceRange[0], priceRange[1]),
    seed,
    lore: {},
  };
  if (foil) card.foil = true;
  if (featured) card.featured = true;
  if (graded) {
    const value = pick([7, 8, 8.5, 9, 9.5, 10]);
    const company = pick(['PSA', 'BGS']);
    card.grade = { company, value, label: `${company} ${value}${value >= 9.5 ? ' GEM MINT' : value >= 9 ? ' MINT' : ''}` };
  }
  card.lore.blurb = blurb(card);
  if (rand() < 0.45) card.lore.funFact = pick(FACTS);
  if (rarity !== 'common') card.lore.investmentNote = pick(NOTES);
  cards.push(card);
}

const SPORTS = ['baseball', 'basketball', 'football', 'hockey', 'tcg'];

// Shelf stock: 16 per sport (5 rookies, 4 vintage, 7 stars), a few foils
for (const sport of SPORTS) {
  for (let i = 0; i < 5; i++) addCard({ sport, category: 'rookies', rarity: i === 0 ? 'rare' : 'common', priceRange: [400, 3500] });
  for (let i = 0; i < 4; i++) addCard({ sport, category: 'vintage', rarity: i === 0 ? 'rare' : 'common', priceRange: [900, 6000] });
  for (let i = 0; i < 7; i++) {
    const foil = i < 2;
    addCard({ sport, category: 'stars', rarity: foil ? 'premium' : i < 4 ? 'rare' : 'common', priceRange: foil ? [3000, 12000] : [300, 2500], foil });
  }
}

// Display case: 10 featured (6 graded slabs, 4 premium foils)
for (let i = 0; i < 6; i++) {
  addCard({ sport: pick(SPORTS), category: 'graded-slabs', rarity: 'graded', priceRange: [9000, 55000], featured: true, graded: true });
}
for (let i = 0; i < 4; i++) {
  addCard({ sport: pick(SPORTS), category: 'graded-slabs', rarity: 'premium', priceRange: [6000, 20000], featured: true, foil: true });
}

// Discount bins: 10 each
for (let i = 0; i < 10; i++) addCard({ sport: pick(SPORTS), category: 'budget-box', rarity: 'common', priceRange: [50, 400] });
for (let i = 0; i < 10; i++) addCard({ sport: pick(SPORTS), category: 'budget-box-b', rarity: 'common', priceRange: [50, 400] });

const out = join(__dirname, '..', 'shared', 'data', 'inventory.json');
writeFileSync(out, JSON.stringify({ cards }, null, 2) + '\n');
console.log(`Wrote ${cards.length} cards to ${out}`);
