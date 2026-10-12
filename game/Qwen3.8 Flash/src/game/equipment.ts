import type { DragOption } from './types';

export interface RodSpec {
  id: string;
  name: string;
  desc: string;
  price: number;
  castMin: number;
  castMax: number;
  /** metres per second of line recovery at drag 5 */
  reelSpeed: number;
  /** multiplies the pulling force the angler can put on the fish */
  power: number;
  /** 0..1 — a flexible tip absorbs shocks (fewer breakages) */
  forgiveness: number;
  level: number;
}

export interface LineSpec {
  id: string;
  name: string;
  desc: string;
  price: number;
  /** breaking load in kg — this is the tension budget */
  strengthKg: number;
  diameter: number;
  level: number;
}

export interface NetSpec {
  id: string;
  name: string;
  desc: string;
  price: number;
  capacity: number;
  level: number;
}

export const RODS: RodSpec[] = [
  {
    id: 'rod_bamboo',
    name: 'Бамбуковое удилище',
    desc: 'Старое лёгкое удилище из хозяина отца. Дальность небольшая, но tip прощает ошибки.',
    price: 0,
    castMin: 6,
    castMax: 30,
    reelSpeed: 1.35,
    power: 1.0,
    forgiveness: 0.34,
    level: 1,
  },
  {
    id: 'rod_match',
    name: 'Матчевое удилище 4,2 м',
    desc: 'Быстрый бланк, дальний заброс и чувствительная вершинка. Хорош по белой рыбе.',
    price: 1900,
    castMin: 7,
    castMax: 40,
    reelSpeed: 1.62,
    power: 1.18,
    forgiveness: 0.44,
    level: 2,
  },
  {
    id: 'rod_feeder',
    name: 'Фидерное «Тайга» 3,9 м',
    desc: 'Мощный бланк для язя, карпа и щуки. Тянет быстро, но требует мягкой руки на вываживании.',
    price: 4600,
    castMin: 8,
    castMax: 48,
    reelSpeed: 1.95,
    power: 1.42,
    forgiveness: 0.52,
    level: 3,
  },
];

export const LINES: LineSpec[] = [
  {
    id: 'line_35',
    name: 'Леска 0,22 мм (3,5 кг)',
    desc: 'Тонкая мононить. На ней подсечка мягче, но крупная рыба легко её порвёт.',
    price: 0,
    strengthKg: 3.5,
    diameter: 0.22,
    level: 1,
  },
  {
    id: 'line_5',
    name: 'Леска 0,28 мм (5 кг)',
    desc: 'Золотая середина для озёрной рыбы.',
    price: 950,
    strengthKg: 5,
    diameter: 0.28,
    level: 2,
  },
  {
    id: 'line_7',
    name: 'Леска 0,35 мм (7 кг)',
    desc: 'Толстая леска: терпит силовое вываживание карпа.',
    price: 2500,
    strengthKg: 7,
    diameter: 0.35,
    level: 3,
  },
  {
    id: 'line_9',
    name: 'Плетёный шнур 0,20 мм (9 кг)',
    desc: 'Нерастяжимый шнур. Максимальная тяга, но каждая рывковая перегрузка передаётся в снасть.',
    price: 5400,
    strengthKg: 9,
    diameter: 0.2,
    level: 4,
  },
];

export const NETS: NetSpec[] = [
  { id: 'net_6', name: 'Садок на 6 рыбы', desc: 'Небольшой дорожный садок.', price: 0, capacity: 6, level: 1 },
  {
    id: 'net_12',
    name: 'Садок на 12 рыбы',
    desc: 'Двухсекционный садок — рыбы живее и влезает больше.',
    price: 750,
    capacity: 12,
    level: 2,
  },
  {
    id: 'net_20',
    name: 'Садок на 20 рыбы',
    desc: 'Большая сетка на 4 м. Для рыбалки с трофеями.',
    price: 1900,
    capacity: 20,
    level: 3,
  },
  {
    id: 'net_30',
    name: 'Садок на 30 рыбы',
    desc: 'Промышленный садок: за один выход можно выловить всё озеро.',
    price: 3800,
    capacity: 30,
    level: 4,
  },
];

export const byId = <T extends { id: string }>(list: T[], id: string, fallback: T): T =>
  list.find((x) => x.id === id) ?? fallback;

export const rodById = (id: string) => byId(RODS, id, RODS[0]);
export const lineById = (id: string) => byId(LINES, id, LINES[0]);
export const netById = (id: string) => byId(NETS, id, NETS[0]);

/** Everything the shop sells, in display order. */
export function shopCatalog(baitPrices: { id: string; name: string; price: number; amount: number }[]): DragOption[] {
  const items: DragOption[] = [];
  for (const b of baitPrices) {
    items.push({
      id: b.id,
      kind: 'bait',
      name: b.name,
      desc: `Пачка наживки: +${b.amount} шт.`,
      price: b.price,
      bait: b.id as never,
      amount: b.amount,
    });
  }
  for (const r of RODS.slice(1)) {
    items.push({ id: r.id, kind: 'rod', name: r.name, desc: r.desc, price: r.price });
  }
  for (const l of LINES.slice(1)) {
    items.push({ id: l.id, kind: 'line', name: l.name, desc: l.desc, price: l.price });
  }
  for (const n of NETS.slice(1)) {
    items.push({ id: n.id, kind: 'net', name: n.name, desc: n.desc, price: n.price });
  }
  return items;
}
