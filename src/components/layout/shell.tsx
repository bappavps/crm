"use client"

import { usePathname } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { UserNav } from "@/components/layout/user-nav"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { PermissionKey } from "@/components/auth/permission-context"

// Map of routes to permission keys
const routePermissionMap: Record<string, PermissionKey> = {
  "/": "dashboard",
  "/estimate": "estimates",
  "/sales-order": "salesOrders",
  "/sales/create-job": "createJob",
  "/design/production-planning": "jobPlanning",
  "/artwork": "artwork",
  "/purchase": "purchaseOrders",
  "/purchase/grn": "grn",
  "/inventory/dashboard": "stockDashboard",
  "/inventory": "stockRegistry",
  "/inventory/slitting": "slitting",
  "/inventory/finished-goods": "finishedGoods",
  "/die": "dieManagement",
  "/production/job-card": "jobCards",
  "/bom": "bom",
  "/work-order": "workOrders",
  "/production": "liveFloor",
  "/qc": "qualityControl",
  "/dispatch": "dispatch",
  "/billing": "billing",
  "/reports": "reports",
  "/admin/permissions": "admin",
  "/admin/approval": "admin",
  "/admin/migrate": "admin",
  "/admin/stock-import": "admin",
  "/users": "admin",
  "/master-data": "admin",
  "/master-data/pricing-settings": "admin",
  "/master-data/roll-settings": "admin",
  "/master-data/job-settings": "admin",
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"
  const isUnauthorizedPage = pathname === "/unauthorized"

  if (isLoginPage) {
    return <>{children}</>
  }

  // Determine required permission based on route
  // We check for exact matches or prefix matches for nested routes
  const requiredPermission = Object.keys(routePermissionMap).find(route => 
    pathname === route || (route !== "/" && pathname.startsWith(route))
  ) ? routePermissionMap[Object.keys(routePermissionMap).find(route => 
    pathname === route || (route !== "/" && pathname.startsWith(route))
  )!] : undefined;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full sidebar-wrapper">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-auto">
          <header className="h-16 border-b bg-card flex items-center px-6 sticky top-0 z-10 gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-primary">Shree Label Creation CRM</h1>
            </div>
            <NotificationBell />
            <UserNav />
          </header>
          <main className="p-6">
            {isUnauthorizedPage ? (
              children
            ) : (
              <ProtectedRoute permission={requiredPermission}>
                {children}
              </ProtectedRoute>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
