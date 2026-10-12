/** Russian-locale number formatting helpers. */

export const num = (v: number, digits = 2) =>
  v.toFixed(digits).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const kg = (v: number) => `${num(v, 2)} кг`;

export const grams = (v: number) => (v < 1 ? `${Math.round(v * 1000)} г` : `${num(v, 2)} кг`);

export const cm = (v: number) => `${num(v, 0)} см`;

export const meters = (v: number, digits = 1) => `${num(v, digits)} м`;

export const rub = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

export const clockLabel = (hourFloat: number) => {
  const h = Math.floor(hourFloat) % 24;
  const m = Math.floor((hourFloat - Math.floor(hourFloat)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const percent = (v: number) => `${Math.round(v)}%`;

/** "утро / день / вечер / ночь" descriptor used in help text. */
export const dayPart = (hour: number) => {
  if (hour < 4) return 'глубокая ночь';
  if (hour < 7) return 'раннее утро';
  if (hour < 11) return 'утро';
  if (hour < 16) return 'день';
  if (hour < 19) return 'день';
  if (hour < 21.5) return 'вечер';
  return 'ночь';
};
