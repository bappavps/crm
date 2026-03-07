
"use client"

import { 
  LayoutDashboard, 
  Calculator, 
  ShoppingCart, 
  Palette, 
  IdCard, 
  ClipboardList, 
  Factory, 
  Package, 
  Truck, 
  ShieldCheck, 
  Receipt, 
  BarChart, 
  Settings, 
  Users,
  Layers,
  Wrench,
  Scissors,
  Box,
  ClipboardCheck,
  Hash,
  ShieldAlert,
  Database,
  FileUp,
  LineChart,
  Lock,
  FileText,
  FileJson,
  ClipboardType,
  Boxes,
  ShoppingBag
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { usePermissions, PermissionKey } from "@/components/auth/permission-context"

interface NavItem {
  name: string;
  icon: any;
  href: string;
  permission: PermissionKey;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Sales & Estimating",
    items: [
      { name: 'Calculator', icon: Calculator, href: '/estimate', permission: 'estimates' },
      { name: 'Estimates', icon: ClipboardType, href: '/estimates', permission: 'estimates' },
      { name: 'Quotations', icon: FileText, href: '/sales/quotations', permission: 'quotations' },
      { name: 'Sales Orders', icon: ShoppingCart, href: '/sales-order', permission: 'salesOrders' },
    ]
  },
  {
    label: "Design & Prepress",
    items: [
      { name: 'Artwork Gallery', icon: Palette, href: '/artwork', permission: 'artwork' },
      { name: 'Job Planning', icon: ClipboardList, href: '/design/production-planning', permission: 'jobPlanning' },
    ]
  },
  {
    label: "Inventory Hub",
    items: [
      { name: 'Paper Stock', icon: Boxes, href: '/paper-stock', permission: 'stockRegistry' },
      { name: 'Slitting', icon: Scissors, href: '/inventory/slitting', permission: 'slitting' },
      { name: 'Finished Goods', icon: Box, href: '/inventory/finished-goods', permission: 'finishedGoods' },
      { name: 'Die Tooling', icon: Wrench, href: '/die', permission: 'dieManagement' },
    ]
  },
  {
    label: "Production",
    items: [
      { name: 'Job Cards', icon: IdCard, href: '/production/job-card', permission: 'jobCards' },
      { name: 'BOM Master', icon: Layers, href: '/bom', permission: 'bom' },
      { name: 'Live Floor', icon: Factory, href: '/production', permission: 'liveFloor' },
    ]
  },
  {
    label: "Purchase",
    items: [
      { name: 'Purchase Orders', icon: ShoppingBag, href: '/purchase', permission: 'purchaseOrders' },
    ]
  },
  {
    label: "Quality & Logistics",
    items: [
      { name: 'QC Reports', icon: ShieldCheck, href: '/qc', permission: 'qualityControl' },
      { name: 'Dispatch', icon: Truck, href: '/dispatch', permission: 'dispatch' },
      { name: 'Billing', icon: Receipt, href: '/billing', permission: 'billing' },
    ]
  },
  {
    label: "Analytics",
    items: [
      { name: 'Performance', icon: LineChart, href: '/inventory/dashboard', permission: 'stockDashboard' },
      { name: 'Reports', icon: BarChart, href: '/reports', permission: 'reports' },
    ]
  }
]

const adminNavigation = [
  { name: 'Stock Import', icon: FileUp, href: '/stock-import', permission: 'admin' as PermissionKey },
  { name: 'Master Data', icon: Settings, href: '/master-data', permission: 'admin' as PermissionKey },
  { name: 'User Management', icon: Users, href: '/users', permission: 'admin' as PermissionKey },
  { name: 'Job Approvals', icon: ShieldAlert, href: '/admin/approval', permission: 'admin' as PermissionKey },
  { name: 'Pricing Logic', icon: Calculator, href: '/master-data/pricing-settings', permission: 'admin' as PermissionKey },
  { name: 'DB Migration', icon: Database, href: '/admin/migrate', permission: 'admin' as PermissionKey },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermissions()
  const { setOpenMobile, isMobile } = useSidebar()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  if (!mounted) return null;

  return (
    <Sidebar variant="sidebar" className="bg-sidebar border-none shadow-xl font-sans">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg">
            <Lock className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="block font-black text-white text-lg tracking-tighter uppercase">Shree Label</span>
            <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold">ERP Solutions</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              {hasPermission('dashboard') && (
                <SidebarMenuButton asChild isActive={pathname === '/'} onClick={handleNavClick}>
                  <Link href="/">
                    <LayoutDashboard className="mr-3" />
                    <span className="font-bold">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => hasPermission(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} className="mt-2">
              <SidebarGroupLabel className="px-4 text-[9px] font-black text-sidebar-foreground/40 uppercase tracking-widest mb-1">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {visibleItems.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={pathname === item.href}
                      className="px-4 py-1.5 transition-all duration-200 h-9"
                      onClick={handleNavClick}
                    >
                      <Link href={item.href}>
                        <item.icon className="mr-3 h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-tight">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
        
        {hasPermission('admin') && (
          <SidebarGroup className="mt-4 border-t border-sidebar-border pt-4">
            <SidebarGroupLabel className="px-4 text-[9px] font-black text-sidebar-foreground/40 uppercase tracking-widest mb-1">Control Center</SidebarGroupLabel>
            <SidebarMenu>
              {adminNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.href}
                    className="px-4 py-1.5 transition-all duration-200 h-9"
                    onClick={handleNavClick}
                  >
                    <Link href={item.href}>
                      <item.icon className="mr-3 h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-tight">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
