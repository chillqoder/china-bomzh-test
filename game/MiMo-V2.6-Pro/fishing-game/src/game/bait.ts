import { BaitData } from './types';

export const BAITS: BaitData[] = [
  {
    id: 'worm',
    name: 'Червь',
    description: 'Универсальная наживка. Хорошо привлекает карася, окуня и леща.',
    suitableFor: ['crucian', 'perch', 'bream', 'carp'],
    price: 10,
    quantity: 10,
  },
  {
    id: 'maggot',
    name: 'Опарыш',
    description: 'Мелкая наживка. Идеальна для плотвы и леща.',
    suitableFor: ['roach', 'bream', 'crucian'],
    price: 8,
    quantity: 15,
  },
  {
    id: 'corn',
    name: 'Кукуруза',
    description: 'Ароматная наживка. Любимая еда карася и карпа.',
    suitableFor: ['crucian', 'carp'],
    price: 12,
    quantity: 8,
  },
  {
    id: 'livebait',
    name: 'Живец',
    description: 'Живая рыбка. Сильно привлекает щуку и крупного окуня.',
    suitableFor: ['pike', 'perch'],
    price: 25,
    quantity: 5,
  },
];

export function getBaitById(id: string): BaitData {
  return BAITS.find((b) => b.id === id) || BAITS[0];
}
