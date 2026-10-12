export function formatKg(kg: number): string {
  return `${kg.toFixed(2).replace(".", ",")} кг`;
}

export function formatCm(cm: number): string {
  return `${Math.round(cm)} см`;
}

export function formatMoney(value: number): string {
  const rounded = Math.round(value);
  const text = rounded.toLocaleString("ru-RU").replace(/\u00a0/g, " ");
  return `${text} ₽`;
}

export function formatDistance(m: number): string {
  return `${m.toFixed(1).replace(".", ",")} м`;
}

export function formatTime(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function timeOfDayLabel(hour: number): string {
  const h = Math.floor(hour) % 24;
  if (h >= 5 && h < 11) return "Утро";
  if (h >= 11 && h < 17) return "День";
  if (h >= 17 && h < 22) return "Вечер";
  return "Ночь";
}

export function formatWeightPlain(kg: number): string {
  return kg.toFixed(2).replace(".", ",");
}
