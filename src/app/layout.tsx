import type {Metadata} from 'next';
import { Inter } from "next/font/google";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { AuthInitializer } from "@/components/auth-initializer";
import { PermissionProvider } from "@/components/auth/permission-context";
import { AppShell } from "@/components/layout/shell";
import { PwaInitializer } from "@/components/pwa-initializer";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: 'Shree Label Creation CRM',
  description: 'Specialized ERP for Narrow Web Flexo Printing',
  manifest: '/manifest.json',
  themeColor: '#E4892B',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ShreeERP',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png' },
    ],
  },
};

/**
 * Root Layout - Server Component
 * Handles global providers and font injection.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={cn(inter.variable, inter.className, "font-sans antialiased bg-background")} suppressHydrationWarning>
        <Suspense fallback={null}>
          <FirebaseClientProvider>
            {/* PWA registration logic */}
            <PwaInitializer />
            
            {/* AuthInitializer handles redirection and profile provisioning */}
            <AuthInitializer />
            
            <PermissionProvider>
              {/* AppShell provides the sidebar, header, and main container */}
              <AppShell>
                {children}
              </AppShell>
            </PermissionProvider>
            
            <Toaster />
          </FirebaseClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
