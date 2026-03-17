
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
  ShoppingBag,
  Printer,
  ChevronRight,
  UserCog,
  LayoutTemplate,
  NotebookPen
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { usePermissions, PermissionKey } from "@/components/auth/permission-context"
import { cn } from "@/lib/utils"

interface SubNavItem {
  name: string;
  href: string;
}

interface NavItem {
  name: string;
  icon: any;
  href: string;
  permission: PermissionKey;
  subItems?: SubNavItem[];
}

const masterGroup = {
  label: "MASTER",
  items: [
    { name: 'Master Data', icon: Settings, href: '/master-data', permission: 'admin' as PermissionKey },
    { name: 'Stock Import & Export', icon: FileUp, href: '/stock-import', permission: 'admin' as PermissionKey },
    { name: 'User Management', icon: Users, href: '/users', permission: 'admin' as PermissionKey },
    { name: 'Print Studio', icon: Printer, href: '/admin/print-studio', permission: 'printStudio' as PermissionKey },
    { name: 'Job Approvals', icon: ShieldAlert, href: '/admin/approval', permission: 'admin' as PermissionKey },
    { name: 'Pricing Logic', icon: Calculator, href: '/master-data/pricing-settings', permission: 'admin' as PermissionKey },
  ]
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
      {
        name: 'Job Planning',
        icon: NotebookPen,
        href: '/planning',
        permission: 'jobPlanning',
        subItems: [
          { name: 'Label Printing', href: '/planning/label-printing' },
          { name: 'Jumbo Slitting', href: '/planning/jumbo-slitting' },
          { name: 'Printing', href: '/planning/printing' },
          { name: 'Flatbed', href: '/planning/flatbed' },
          { name: 'Rotery Die', href: '/planning/rotery-die' },
          { name: 'Label Slitting', href: '/planning/label-slitting' },
          { name: 'Batch Code', href: '/planning/batch-code' },
          { name: 'Packing', href: '/planning/packing' },
          { name: 'Dispatch', href: '/planning/dispatch' },
        ]
      },
    ]
  },
  {
    label: "Operator",
    items: [
      {
        name: 'Machine Operators',
        icon: UserCog,
        href: '/operators',
        permission: 'liveFloor',
        subItems: [
          { name: 'Jumbo Operator', href: '/operators/jumbo' },
          { name: 'POS Roll Operator', href: '/operators/pos-roll' },
          { name: 'One Ply Operator', href: '/operators/one-ply' },
          { name: 'Printing Operator', href: '/operators/printing' },
          { name: 'Flat Bed Operator', href: '/operators/flat-bed' },
          { name: 'Rotery Die Operator', href: '/operators/rotery-die' },
          { name: 'Label Slitting Operator', href: '/operators/label-slitting' },
          { name: 'Packing Section', href: '/operators/packing' },
        ]
      }
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
      { 
        name: 'Job Cards', 
        icon: IdCard, 
        href: '/production/job-card', 
        permission: 'jobCards',
        subItems: [
          { name: 'Jumbo Job', href: '/production/jobcards/jumbo-job' },
          { name: 'POS Roll', href: '/production/jobcards/pos-roll' },
          { name: 'One Ply', href: '/production/jobcards/one-ply' },
          { name: 'Printing', href: '/production/jobcards/printing' },
          { name: 'Flat Bed', href: '/production/jobcards/flat-bed' },
          { name: 'Rotery Die', href: '/production/jobcards/rotery-die' },
          { name: 'Label Slitting', href: '/production/jobcards/label-slitting' },
          { name: 'Packing Slip', href: '/production/jobcards/packing-slip' },
        ]
      },
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

export function AppSidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermissions()
  const { setOpenMobile, isMobile, state } = useSidebar()
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
    <Sidebar variant="sidebar" collapsible="icon" className="bg-sidebar border-none shadow-xl font-sans transition-all duration-300">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shrink-0">
            <Lock className="text-white w-6 h-6" />
          </div>
          {state === "expanded" && (
            <div className="animate-in fade-in duration-500">
              <span className="block font-black text-white text-lg tracking-tighter uppercase whitespace-nowrap">Shree Label</span>
              <span className="block text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold whitespace-nowrap">ERP Solutions</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              {hasPermission('dashboard') && (
                <SidebarMenuButton asChild isActive={pathname === '/'} onClick={handleNavClick} tooltip="Dashboard">
                  <Link href="/">
                    <LayoutDashboard className="mr-3" />
                    <span className="font-bold">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* OPERATIONAL GROUPS FIRST */}
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => hasPermission(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} className="mt-2">
              <SidebarGroupLabel className="px-4 text-[9px] font-black text-sidebar-foreground/40 uppercase tracking-widest mb-1 group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {visibleItems.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    {item.subItems ? (
                      <Collapsible defaultOpen={pathname.startsWith(item.href)} className="group/collapsible">
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.name} className="px-4 py-1.5 h-9">
                            <item.icon className="mr-3 h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-tight">{item.name}</span>
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="ml-4 border-l border-white/10 pl-2 mt-1 space-y-1">
                            {item.subItems.map((sub) => (
                              <SidebarMenuSubItem key={sub.name}>
                                <SidebarMenuSubButton asChild isActive={pathname === sub.href} onClick={handleNavClick} className={cn(
                                  "h-10 px-4 rounded-lg transition-all duration-200 hover:bg-white/5",
                                  pathname === sub.href && "text-primary border-l-2 border-primary bg-white/5 rounded-l-none"
                                )}>
                                  <Link href={sub.href}>
                                    <span className="text-[13px] font-medium">{sub.name}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                                <div className="h-[1px] w-full bg-white/[0.08] mt-1.5" />
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <SidebarMenuButton 
                        asChild 
                        isActive={pathname === item.href}
                        className="px-4 py-1.5 transition-all duration-200 h-9"
                        onClick={handleNavClick}
                        tooltip={item.name}
                      >
                        <Link href={item.href}>
                          <item.icon className="mr-3 h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-tight">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}

        {/* MASTER GROUP LAST */}
        {hasPermission('admin') && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="px-4 text-[9px] font-black text-sidebar-foreground/40 uppercase tracking-widest mb-1 group-data-[collapsible=icon]:hidden">
              {masterGroup.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {masterGroup.items.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.href} 
                    className="px-4 py-1.5 h-9" 
                    onClick={handleNavClick}
                    tooltip={item.name}
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
