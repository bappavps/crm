
"use client"

import { usePathname } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { UserNav } from "@/components/layout/user-nav"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
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
  )
}
