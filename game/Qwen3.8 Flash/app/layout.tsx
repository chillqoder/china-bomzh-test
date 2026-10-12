import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Утренний пруд — 3D рыбалка',
  description:
    'Трёхмерная рыбалка на лесном озере: заброс, поклёвка, вываживание, трофеи, садок и снасти. Интерфейс на русском.',
  applicationName: 'Утренний пруд',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d1a1d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
