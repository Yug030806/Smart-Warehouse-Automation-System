'use strict';
// Global style settings for CSS variables and styling overrides.
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'SmartWarehouse Autonomous Logistics System',
  description: 'AI-assisted routing, autonomous AMR simulation, QR scanner verification, and live tracking dashboard.',
};

import { AuthProvider } from '@/lib/supabase/AuthProvider';
import { ThemeProvider } from '@/lib/ThemeProvider';
import MotionBackground from '@/components/MotionBackground';
import AlertPopupModal from '@/components/AlertPopupModal';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="theme-dark">
      <body className={`${inter.className} min-h-screen bg-transparent text-slate-100 antialiased overflow-x-hidden`}>
        <AuthProvider>
          <ThemeProvider>
            <MotionBackground />
            <AlertPopupModal />
            <div className="relative z-10 min-h-screen">
              {children}
            </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
