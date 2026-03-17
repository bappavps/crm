
"use client"

import { usePathname } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { UserNav } from "@/components/layout/user-nav"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { PermissionKey } from "@/components/auth/permission-context"
import { Separator } from "@/components/ui/separator"

// Map of routes to permission keys
const routePermissionMap: Record<string, PermissionKey> = {
  "/": "dashboard",
  "/estimate": "estimates",
  "/estimates": "estimates",
  "/sales/quotations": "quotations",
  "/sales-order": "salesOrders",
  "/sales/create-job": "createJob",
  "/design/production-planning": "jobPlanning",
  "/production/printed-label-planning": "jobPlanning",
  "/artwork": "artwork",
  "/purchase": "purchaseOrders",
  "/paper-stock": "stockRegistry",
  "/stock-import": "stockRegistry",
  "/inventory/dashboard": "stockDashboard",
  "/inventory/slitting": "slitting",
  "/inventory/finished-goods": "finishedGoods",
  "/die": "dieManagement",
  "/production/job-card": "jobCards",
  "/production/jobcards/jumbo-job": "jobCards",
  "/production/jobcards/pos-roll": "jobCards",
  "/production/jobcards/one-ply": "jobCards",
  "/production/jobcards/printing": "jobCards",
  "/production/jobcards/flat-bed": "jobCards",
  "/production/jobcards/rotery-die": "jobCards",
  "/production/jobcards/label-slitting": "jobCards",
  "/production/jobcards/packing-slip": "jobCards",
  "/operators/jumbo": "liveFloor",
  "/operators/pos-roll": "liveFloor",
  "/operators/one-ply": "liveFloor",
  "/operators/printing": "liveFloor",
  "/operators/flat-bed": "liveFloor",
  "/operators/rotery-die": "liveFloor",
  "/operators/label-slitting": "liveFloor",
  "/operators/packing": "liveFloor",
  "/bom": "bom",
  "/work-order": "workOrders",
  "/production": "liveFloor",
  "/qc": "qualityControl",
  "/dispatch": "dispatch",
  "/billing": "billing",
  "/reports": "reports",
  "/admin/approval": "admin",
  "/admin/migrate": "admin",
  "/users": "admin",
  "/master-data": "admin",
  "/master-data/pricing-settings": "admin",
  "/master-data/roll-settings": "admin",
  "/admin/print-studio": "printStudio",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"
  const isUnauthorizedPage = pathname === "/unauthorized"

  if (isLoginPage) {
    return <>{children}</>
  }

  const matchedRoute = Object.keys(routePermissionMap).find(route => 
    pathname === route || (route !== "/" && pathname.startsWith(route))
  );
  const requiredPermission = matchedRoute ? routePermissionMap[matchedRoute] : undefined;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full sidebar-wrapper bg-background" suppressHydrationWarning>
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0 transition-all duration-300">
          <header className="h-16 shrink-0 border-b bg-card flex items-center px-4 md:px-6 sticky top-0 z-20 gap-2 md:gap-4 shadow-sm transition-all duration-300">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />
            <div className="flex-1 truncate">
              <h1 className="text-xs md:text-xl font-black text-primary truncate uppercase tracking-tighter">Shree Label Creation CRM</h1>
            </div>
            <div className="flex items-center gap-1 md:gap-4">
              <NotificationBell />
              <UserNav />
            </div>
          </header>
          
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="w-full pb-32 transition-all duration-300">
              {isUnauthorizedPage ? (
                children
              ) : (
                <ProtectedRoute permission={requiredPermission}>
                  {children}
                </ProtectedRoute>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
