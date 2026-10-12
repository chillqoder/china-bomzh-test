import type { BaitId, SpeciesId } from './types';

export interface BaitDef {
  id: BaitId;
  ru: string;
  en: string;
  desc: string;
  price: number;
  packSize: number;
  /** which species it is good for, shown in the UI */
  suits: SpeciesId[];
  color: number;
}

export const BAITS: Record<BaitId, BaitDef> = {
  cherv: {
    id: 'cherv',
    ru: 'Червь',
    en: 'Worm',
    desc: 'Классическая наживка. Работает почти по всей мирной рыбе, особенно по утрам.',
    price: 55,
    packSize: 10,
    suits: ['karas', 'okun', 'leshch', 'karp'],
    color: 0xa8543c,
  },
  oparysh: {
    id: 'oparysh',
    ru: 'Опарыш',
    en: 'Maggot',
    desc: 'Мелкая белая личинка. Отлично собирает плотву и подлещика, не так привлекает карася.',
    price: 65,
    packSize: 10,
    suits: ['plotva', 'leshch', 'karas'],
    color: 0xe7e3cf,
  },
  kukuruza: {
    id: 'kukuruza',
    ru: 'Кукуруза',
    en: 'Corn',
    desc: 'Насадка для осторожной белой рыбы. Карась и карп любят её больше всего.',
    price: 75,
    packSize: 10,
    suits: ['karas', 'karp', 'leshch'],
    color: 0xe7b53a,
  },
  zhivets: {
    id: 'zhivets',
    ru: 'Живец',
    en: 'Live bait',
    desc: 'Плотвичка или карасик на крючке. Единственная серьёзная насадка на щуку.',
    price: 130,
    packSize: 5,
    suits: ['shchuka', 'okun'],
    color: 0x8fb98f,
  },
};

export const BAIT_ORDER: BaitId[] = ['cherv', 'oparysh', 'kukuruza', 'zhivets'];
