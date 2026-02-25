import type {Metadata} from 'next';
import { Inter } from "next/font/google";
import './globals.css';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase";
import { AuthInitializer } from "@/components/auth-initializer";
import { UserNav } from "@/components/layout/user-nav";

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
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full sidebar-wrapper">
              <AppSidebar />
              <SidebarInset className="flex flex-col flex-1 overflow-auto">
                <header className="h-16 border-b bg-card flex items-center px-6 sticky top-0 z-10">
                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-primary">Shree Label ERP</h1>
                  </div>
                  <UserNav />
                </header>
                <main className="p-6">
                  {children}
                </main>
              </SidebarInset>
            </div>
          </SidebarProvider>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
