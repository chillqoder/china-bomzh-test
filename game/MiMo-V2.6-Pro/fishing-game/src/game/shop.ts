export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'bait' | 'line' | 'rod' | 'keepnet';
  price: number;
  level: number;
  effect: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'bait_worm',
    name: 'Червь ×10',
    description: '10 червей для рыбалки',
    type: 'bait',
    price: 80,
    level: 1,
    effect: '+10 червей',
  },
  {
    id: 'bait_maggot',
    name: 'Опарыш ×15',
    description: '15 опарышей для рыбалки',
    type: 'bait',
    price: 60,
    level: 1,
    effect: '+15 опарышей',
  },
  {
    id: 'bait_corn',
    name: 'Кукуруза ×10',
    description: '10 зёрен кукурузы',
    type: 'bait',
    price: 100,
    level: 1,
    effect: '+10 кукурузы',
  },
  {
    id: 'bait_livebait',
    name: 'Живец ×5',
    description: '5 живцов для ловли щуки',
    type: 'bait',
    price: 150,
    level: 2,
    effect: '+5 живцов',
  },
  {
    id: 'line_2',
    name: 'Леска 2-го уровня',
    description: 'Более прочная леска (выдерживает больше нагрузки)',
    type: 'line',
    price: 300,
    level: 2,
    effect: '+3 к прочности лески',
  },
  {
    id: 'line_3',
    name: 'Леска 3-го уровня',
    description: 'Сильная леска для крупной рыбы',
    type: 'line',
    price: 700,
    level: 3,
    effect: '+3 к прочности лески',
  },
  {
    id: 'line_4',
    name: 'Леска 4-го уровня',
    description: 'Профессиональная леска',
    type: 'line',
    price: 1500,
    level: 5,
    effect: '+3 к прочности лески',
  },
  {
    id: 'rod_2',
    name: 'Удилище 2-го уровня',
    description: 'Более мощное удилище',
    type: 'rod',
    price: 400,
    level: 2,
    effect: '+0.3 к силе удилища',
  },
  {
    id: 'rod_3',
    name: 'Удилище 3-го уровня',
    description: 'Профессиональное удилище',
    type: 'rod',
    price: 900,
    level: 3,
    effect: '+0.3 к силе удилища',
  },
  {
    id: 'rod_4',
    name: 'Удилище 4-го уровня',
    description: 'Элитное удилище',
    type: 'rod',
    price: 2000,
    level: 5,
    effect: '+0.3 к силе удилища',
  },
  {
    id: 'keepnet_2',
    name: 'Садок 2-го уровня',
    description: 'Вмещает больше рыбы',
    type: 'keepnet',
    price: 250,
    level: 2,
    effect: '+3 места в садке',
  },
  {
    id: 'keepnet_3',
    name: 'Садок 3-го уровня',
    description: 'Большой садок',
    type: 'keepnet',
    price: 600,
    level: 3,
    effect: '+3 места в садке',
  },
  {
    id: 'keepnet_4',
    name: 'Садок 4-го уровня',
    description: 'Огромный садок',
    type: 'keepnet',
    price: 1200,
    level: 5,
    effect: '+3 места в садке',
  },
];
