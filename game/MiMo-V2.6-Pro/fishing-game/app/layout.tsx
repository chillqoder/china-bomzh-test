import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Рыбалка 3D — Озеро',
  description: '3D симулятор рыбалки на озере в русской глубинке',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
