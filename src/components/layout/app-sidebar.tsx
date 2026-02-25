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
  Wrench
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

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { name: 'Estimates', icon: Calculator, href: '/estimate' },
  { name: 'BOM', icon: Layers, href: '/bom' },
  { name: 'Sales Order', icon: ShoppingCart, href: '/sales-order' },
  { name: 'Artwork Management', icon: Palette, href: '/artwork' },
  { name: 'Job Card', icon: IdCard, href: '/job-card' },
  { name: 'Work Order', icon: ClipboardList, href: '/work-order' },
  { name: 'Production', icon: Factory, href: '/production' },
  { name: 'Inventory', icon: Package, href: '/inventory' },
  { name: 'Purchase', icon: ShoppingCart, href: '/purchase' },
  { name: 'Die Management', icon: Wrench, href: '/die' },
  { name: 'Quality Control', icon: ShieldCheck, href: '/qc' },
  { name: 'Billing', icon: Receipt, href: '/billing' },
  { name: 'Dispatch', icon: Truck, href: '/dispatch' },
  { name: 'Reports', icon: BarChart, href: '/reports' },
]

const adminNavigation = [
  { name: 'Master Data', icon: Settings, href: '/master-data' },
  { name: 'User Management', icon: Users, href: '/users' },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="sidebar" className="bg-sidebar border-none shadow-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <FileText className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="block font-bold text-white text-lg">SLC ERP</span>
            <span className="block text-[10px] text-muted-foreground uppercase tracking-widest">Shree Label Creation</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Main Menu</SidebarGroupLabel>
          <SidebarMenu>
            {navigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.href}
                  className="px-4 py-2 transition-all duration-200"
                >
                  <Link href={item.href}>
                    <item.icon className="mr-3" />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Administration</SidebarGroupLabel>
          <SidebarMenu>
            {adminNavigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.href}
                  className="px-4 py-2 transition-all duration-200"
                >
                  <Link href={item.href}>
                    <item.icon className="mr-3" />
                    <span>{item.name}</span>
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