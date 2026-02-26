import type {Metadata} from 'next';
import { Inter } from "next/font/google";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { AuthInitializer } from "@/components/auth-initializer";
import { PermissionProvider } from "@/components/auth/permission-context";
import { AppShell } from "@/components/layout/shell";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: 'Shree Label Creation CRM',
  description: 'Specialized ERP for Narrow Web Flexo Printing',
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
      <body className={cn(inter.className, "antialiased bg-background overflow-hidden")}>
        <FirebaseClientProvider>
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
      </body>
    </html>
  );
}
