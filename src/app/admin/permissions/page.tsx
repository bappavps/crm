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
   * Ensures all keys in ALL_SYSTEM_KEYS are categorized and displayed.
   */
  const getCategorizedPermissions = (rolePermissions: Record<string, boolean> = {}) => {
    const grouped: Record<string, [string, boolean][]> = {};
    
    // We iterate over the MASTER list, not the role's current keys
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Access Control Panel</h2>
          <p className="text-muted-foreground">Manage global roles and dynamic permission discovery.</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-bold text-lg">DYNAMIC SECURITY V2</Badge>
      </div>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="roles" className="gap-2"><Key className="h-4 w-4" /> Group Roles</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><UserCog className="h-4 w-4" /> User Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="pt-6">
          <div className="grid gap-8">
            {roles?.map((role) => (
              <Card key={role.id} className="overflow-hidden border-none shadow-lg bg-card/50 backdrop-blur-sm">
                <CardHeader className="bg-primary/5 pb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-black text-primary uppercase tracking-tight">{role.name}</CardTitle>
                      <CardDescription>
                        Configuration registry for group level access.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="h-6 px-3 uppercase font-mono">ID: {role.id}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  {getCategorizedPermissions(role.permissions).map((group: any) => (
                    <div key={group.label} className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <group.icon className="h-4 w-4 text-primary" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{group.label}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-4">
                        {group.items.map((entry: [string, boolean]) => {
                          const [key, val] = entry;
                          return (
                            <div key={key} className="flex items-center justify-between py-1 group/item">
                              <span className="text-sm font-medium text-foreground group-hover/item:text-primary transition-colors">
                                {formatPermissionLabel(key)}
                              </span>
                              <Switch 
                                checked={val} 
                                onCheckedChange={() => handleToggleRolePermission(role.id, key, val)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
            
            <Button variant="outline" className="border-dashed h-16 text-lg font-bold text-muted-foreground hover:text-primary" onClick={() => toast({ title: "Development", description: "Custom role creation is coming soon." })}>
              <Plus className="mr-2 h-5 w-5" /> Create New Custom Role
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="users" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Employee Permission Registry</CardTitle>
              <CardDescription>Assign roles and manage specific user-level overrides.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Primary Role</TableHead>
                    <TableHead>Active Overrides</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold">{u.firstName} {u.lastName}</span>
                          <span className="text-[10px] text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold">{u.roleId || 'No Role'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.customPermissions && Object.keys(u.customPermissions).map(k => (
                            <Badge key={k} variant={u.customPermissions[k] ? "default" : "destructive"} className="text-[9px]">
                              {formatPermissionLabel(k)}: {u.customPermissions[k] ? "ON" : "OFF"}
                            </Badge>
                          ))}
                          {(!u.customPermissions || Object.keys(u.customPermissions).length === 0) && (
                            <span className="text-xs text-muted-foreground italic">Using role defaults</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toast({ title: "Module Development", description: "Granular user override toggles are coming in V3." })}>
                          Manage Overrides
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-bold">Security Best Practice</p>
              <p>Prefer group roles over user overrides whenever possible. Overrides should be used for temporary specialized access or technical debugging.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
