'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  ShieldCheck, 
  Users, 
  Key, 
  Loader2, 
  UserCog, 
  Lock,
  Plus,
  ShoppingCart,
  Boxes,
  Factory,
  CheckCircle2,
  Settings,
  Palette,
  ShoppingBag,
  LineChart,
  LayoutDashboard
} from "lucide-react";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

/**
 * MASTER PERMISSION REGISTRY
 * Defines all 22 potential permission keys in the system and their logical groups.
 */
const PERMISSION_METADATA: Record<string, { group: string; icon: any }> = {
  dashboard: { group: "Core Access", icon: LayoutDashboard },
  estimates: { group: "Sales & CRM", icon: ShoppingCart },
  salesOrders: { group: "Sales & CRM", icon: ShoppingCart },
  createJob: { group: "Sales & CRM", icon: ShoppingCart },
  jobPlanning: { group: "Design & Planning", icon: Palette },
  artwork: { group: "Design & Planning", icon: Palette },
  purchaseOrders: { group: "Purchase & Procurement", icon: ShoppingBag },
  grn: { group: "Purchase & Procurement", icon: ShoppingBag },
  stockDashboard: { group: "Inventory & Materials", icon: Boxes },
  stockRegistry: { group: "Inventory & Materials", icon: Boxes },
  slitting: { group: "Inventory & Materials", icon: Boxes },
  finishedGoods: { group: "Inventory & Materials", icon: Boxes },
  dieManagement: { group: "Inventory & Materials", icon: Boxes },
  jobCards: { group: "Production Floor", icon: Factory },
  bom: { group: "Production Floor", icon: Factory },
  workOrders: { group: "Production Floor", icon: Factory },
  liveFloor: { group: "Production Floor", icon: Factory },
  qualityControl: { group: "Quality & Logistics", icon: CheckCircle2 },
  dispatch: { group: "Quality & Logistics", icon: CheckCircle2 },
  billing: { group: "Quality & Logistics", icon: CheckCircle2 },
  reports: { group: "Analytics", icon: LineChart },
  admin: { group: "System Administration", icon: Lock },
};

const GROUP_ORDER = [
  "Core Access",
  "Sales & CRM",
  "Design & Planning",
  "Purchase & Procurement",
  "Inventory & Materials",
  "Production Floor",
  "Quality & Logistics",
  "Analytics",
  "System Administration",
  "Other Capabilities"
];

const ALL_SYSTEM_KEYS = Object.keys(PERMISSION_METADATA);

const formatPermissionLabel = (key: string) => {
  const acronyms = ["GRN", "BOM", "CRM", "ERP", "QC", "ID", "FG"];
  const words = key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .filter(Boolean);
    
  return words.map(word => {
    const upper = word.toUpperCase();
    if (acronyms.includes(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};

export default function PermissionManagementPage() {
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  // 1. Fetch Roles
  const rolesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'roles');
  }, [firestore]);
  const { data: roles, isLoading: rolesLoading } = useCollection(rolesQuery);

  // 2. Fetch Users
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);

  const handleToggleRolePermission = async (roleId: string, key: string, currentVal: boolean) => {
    if (!firestore) return;
    
    const roleRef = doc(firestore, 'roles', roleId);
    const role = roles?.find(r => r.id === roleId);
    const updatedPermissions = {
      ...(role?.permissions || {}),
      [key]: !currentVal
    };

    try {
      await updateDoc(roleRef, { 
        permissions: updatedPermissions,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid
      });
      toast({ title: "Role Updated", description: `Permission '${formatPermissionLabel(key)}' toggled for ${roleId}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Update Failed", description: "Insufficient permissions." });
    }
  };

  /**
   * Categorizes permissions based on metadata for a structured layout.
   */
  const getCategorizedPermissions = (rolePermissions: Record<string, boolean> = {}) => {
    const grouped: Record<string, [string, boolean][]> = {};
    
    ALL_SYSTEM_KEYS.forEach((key) => {
      const val = !!rolePermissions[key];
      const meta = PERMISSION_METADATA[key];
      const groupName = meta ? meta.group : "Other Capabilities";
      
      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push([key, val]);
    });

    return GROUP_ORDER.map(label => {
      const items = grouped[label] || [];
      if (items.length === 0) return null;
      
      const firstItemKey = items[0][0];
      const icon = PERMISSION_METADATA[firstItemKey]?.icon || (label === "Other Capabilities" ? Key : Settings);

      return { label, icon, items };
    }).filter(Boolean);
  };

  if (rolesLoading || usersLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary">Access Control Panel</h2>
          <p className="text-muted-foreground font-medium">Manage global group roles and individual employee overrides.</p>
        </div>
        <div className="hidden md:block">
          <Badge variant="outline" className="h-10 px-6 font-bold text-lg border-primary/20 bg-primary/5 text-primary">
            22 ACTIVE KEYS
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="roles" className="gap-2 py-2.5 rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Key className="h-4 w-4" /> Group Roles
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 py-2.5 rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <UserCog className="h-4 w-4" /> Employee Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="pt-8 space-y-10 outline-none">
          {roles?.map((role) => (
            <Card key={role.id} className="overflow-hidden border-none shadow-xl bg-card border-border/50">
              <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black text-primary uppercase tracking-tighter">{role.name}</CardTitle>
                    <CardDescription className="font-medium">
                      Operational permissions for all users assigned to the {role.id} role.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="h-8 px-4 font-mono font-black border border-primary/10">ROLE_ID: {role.id}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-12">
                {getCategorizedPermissions(role.permissions).map((group: any) => (
                  <div key={group.label} className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-border/50 pb-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <group.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{group.label}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
                      {group.items.map(([key, val]: [string, boolean]) => (
                        <div key={key} className="flex items-center justify-between py-2 group/item hover:bg-muted/30 px-3 -mx-3 rounded-lg transition-colors">
                          <span className="text-sm font-bold text-foreground group-hover/item:text-primary transition-colors">
                            {formatPermissionLabel(key)}
                          </span>
                          <Switch 
                            checked={val} 
                            onCheckedChange={() => handleToggleRolePermission(role.id, key, val)}
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          
          <Button 
            variant="outline" 
            className="w-full border-dashed h-20 text-lg font-black text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all" 
            onClick={() => toast({ title: "Module Locked", description: "Custom role creation is managed by the DB administrator." })}
          >
            <Plus className="mr-3 h-6 w-6" /> DEFINE NEW SYSTEM ROLE
          </Button>
        </TabsContent>

        <TabsContent value="users" className="pt-8 outline-none">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-3 text-xl font-black">
                <Users className="h-6 w-6 text-primary" /> Employee Permission Registry
              </CardTitle>
              <CardDescription className="font-medium">Assign primary roles and manage individual security exceptions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="font-black uppercase tracking-widest text-[10px]">User Profile</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px]">Inherited Role</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px]">Active Overrides</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-foreground">{u.firstName} {u.lastName}</span>
                          <span className="text-[11px] font-medium text-muted-foreground lowercase">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-black bg-primary/5 border-primary/20 text-primary">
                          {u.roleId?.toUpperCase() || 'NO_ROLE'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {u.customPermissions && Object.keys(u.customPermissions).map(k => (
                            <Badge key={k} variant={u.customPermissions[k] ? "default" : "destructive"} className="text-[9px] font-black uppercase tracking-tighter h-5">
                              {formatPermissionLabel(k)}: {u.customPermissions[k] ? "ON" : "OFF"}
                            </Badge>
                          ))}
                          {(!u.customPermissions || Object.keys(u.customPermissions).length === 0) && (
                            <span className="text-xs text-muted-foreground font-medium italic italic">Standard role defaults applied</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="font-black text-xs hover:text-primary" onClick={() => toast({ title: "Access Restricted", description: "Granular user override toggles are coming in the next security patch." })}>
                          MODIFY ACCESS
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-4 shadow-sm">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Lock className="h-6 w-6 text-amber-700" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-amber-900 uppercase tracking-tight">Security Protocol Advisory</p>
              <p className="text-sm text-amber-800 font-medium leading-relaxed">
                Prefer group roles over user overrides whenever possible. Individual overrides create unique security surfaces that are harder to audit. Use them only for temporary elevated access or specialized technical debugging.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}