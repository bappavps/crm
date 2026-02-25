
import type {Metadata} from 'next';
import { Inter } from "next/font/google";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase";
import { AuthInitializer } from "@/components/auth-initializer";
import { AppShell } from "@/components/layout/shell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: 'Shree Label ERP',
  description: 'Specialized ERP for Narrow Web Flexo Printing',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased bg-background overflow-hidden font-sans" suppressHydrationWarning>
        <FirebaseClientProvider>
          <AuthInitializer />
          <AppShell>
            {children}
          </AppShell>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
