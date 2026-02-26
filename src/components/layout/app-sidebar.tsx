"use client"

import { 
  LayoutDashboard, 
  Calculator, 
  FileText, 
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
  Briefcase,
  ListTodo,
  FilePlus,
  Binary,
  ShieldAlert,
  Database,
  FileUp,
  LineChart
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
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const navGroups = [
  {
    label: "Sales & Estimating",
    items: [
      { name: 'Estimates', icon: Calculator, href: '/estimate' },
      { name: 'Sales Orders', icon: ShoppingCart, href: '/sales-order' },
      { name: 'Create Job', icon: FilePlus, href: '/sales/create-job' },
    ]
  },
  {
    label: "Design & Planning",
    items: [
      { name: 'Job Planning', icon: ListTodo, href: '/design/production-planning' },
      { name: 'Artwork', icon: Palette, href: '/artwork' },
    ]
  },
  {
    label: "Purchase",
    items: [
      { name: 'Purchase Orders', icon: ShoppingCart, href: '/purchase' },
      { name: 'GRN (Jumbo Entry)', icon: ClipboardCheck, href: '/purchase/grn' },
    ]
  },
  {
    label: "Inventory",
    items: [
      { name: 'Stock Dashboard', icon: LineChart, href: '/inventory/dashboard' },
      { name: 'Stock Registry', icon: Package, href: '/inventory' },
      { name: 'Slitting (Conversion)', icon: Scissors, href: '/inventory/slitting' },
      { name: 'Finished Goods', icon: Box, href: '/inventory/finished-goods' },
      { name: 'Die Management', icon: Wrench, href: '/die' },
    ]
  },
  {
    label: "Production",
    items: [
      { name: 'Job Cards', icon: IdCard, href: '/production/job-card' },
      { name: 'BOM', icon: Layers, href: '/bom' },
      { name: 'Work Orders', icon: ClipboardList, href: '/work-order' },
      { name: 'Live Floor', icon: Factory, href: '/production' },
    ]
  },
  {
    label: "Quality & Logistics",
    items: [
      { name: 'Quality Control', icon: ShieldCheck, href: '/qc' },
      { name: 'Dispatch', icon: Truck, href: '/dispatch' },
      { name: 'Billing', icon: Receipt, href: '/billing' },
    ]
  },
  {
    label: "Analytics",
    items: [
      { name: 'Reports', icon: BarChart, href: '/reports' },
    ]
  }
]

const adminNavigation = [
  { name: 'Master Data', icon: Settings, href: '/master-data' },
  { name: 'Stock Import', icon: FileUp, href: '/admin/stock-import' },
  { name: 'Job Approvals', icon: ShieldAlert, href: '/admin/approval' },
  { name: 'Pricing Logic', icon: Calculator, href: '/master-data/pricing-settings' },
  { name: 'Roll Settings', icon: Hash, href: '/master-data/roll-settings' },
  { name: 'Job Settings', icon: Binary, href: '/master-data/job-settings' },
  { name: 'User Management', icon: Users, href: '/users' },
  { name: 'DB Migration', icon: Database, href: '/admin/migrate' },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return (
    <Sidebar variant="sidebar" className="bg-sidebar border-none shadow-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <FileText className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="block font-bold text-white text-lg">Shree Label CRM</span>
          </div>
        </div>
      </SidebarHeader>
    </Sidebar>
  )

  return (
    <Sidebar variant="sidebar" className="bg-sidebar border-none shadow-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <FileText className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="block font-bold text-white text-lg">Shree Label CRM</span>
            <span className="block text-[10px] text-muted-foreground uppercase tracking-widest">Shree Label Creation</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/'}>
                <Link href="/">
                  <LayoutDashboard className="mr-3" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="mt-2">
            <SidebarGroupLabel className="px-4 text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest mb-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.href}
                    className="px-4 py-1.5 transition-all duration-200 h-9"
                  >
                    <Link href={item.href}>
                      <item.icon className="mr-3 h-4 w-4" />
                      <span className="text-sm">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
        
        <SidebarGroup className="mt-4 border-t border-sidebar-border pt-4">
          <SidebarGroupLabel className="px-4 text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest mb-1">Administration</SidebarGroupLabel>
          <SidebarMenu>
            {adminNavigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.href}
                  className="px-4 py-1.5 transition-all duration-200 h-9"
                >
                  <Link href={item.href}>
                    <item.icon className="mr-3 h-4 w-4" />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
