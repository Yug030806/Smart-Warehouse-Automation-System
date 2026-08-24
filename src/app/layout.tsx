'use strict';
// Global style settings for CSS variables and styling overrides.
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Smart Warehouse Autonomous Logistics Platform',
  description: 'AI-assisted routing, autonomous cart simulation, QR scanner verification, and live tracking dashboard.',
};

import { AuthProvider } from '@/lib/supabase/AuthProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-100 antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
