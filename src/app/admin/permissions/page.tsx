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
  Save, 
  UserCog, 
  CheckCircle2, 
  Lock,
  Plus
} from "lucide-react";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { PermissionKey } from "@/components/auth/permission-context";

const PERMISSION_KEYS: PermissionKey[] = [
  'dashboard', 'estimates', 'salesOrders', 'createJob', 
  'jobPlanning', 'artwork', 'purchaseOrders', 'grn', 
  'stockDashboard', 'stockRegistry', 'slitting', 'finishedGoods', 'dieManagement',
  'jobCards', 'bom', 'workOrders', 'liveFloor',
  'qualityControl', 'dispatch', 'billing', 'reports', 'admin'
];

export default function PermissionManagementPage() {
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

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

  const handleToggleRolePermission = async (roleId: string, key: PermissionKey, currentVal: boolean) => {
    if (!firestore) return;
    
    const roleRef = doc(firestore, 'roles', roleId);
    const updatedPermissions = {
      ...(roles?.find(r => r.id === roleId)?.permissions || {}),
      [key]: !currentVal
    };

    try {
      await updateDoc(roleRef, { 
        permissions: updatedPermissions,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid
      });
      toast({ title: "Role Updated", description: `Permission '${key}' updated for ${roleId}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Update Failed", description: "Insufficient permissions." });
    }
  };

  const handleToggleUserOverride = async (userId: string, key: PermissionKey, currentVal: any) => {
    if (!firestore) return;
    
    const userRef = doc(firestore, 'users', userId);
    const user = users?.find(u => u.id === userId);
    const currentOverrides = user?.customPermissions || {};
    
    // Toggle logic: null -> true -> false -> null (removes override)
    let newVal: boolean | null = null;
    if (currentVal === undefined || currentVal === null) newVal = true;
    else if (currentVal === true) newVal = false;
    else newVal = null;

    const updatedOverrides = { ...currentOverrides };
    if (newVal === null) delete updatedOverrides[key];
    else updatedOverrides[key] = newVal;

    try {
      await updateDoc(userRef, { 
        customPermissions: updatedOverrides,
        updatedAt: serverTimestamp()
      });
      toast({ title: "User Override Updated", description: `Custom flag set for ${user?.firstName}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Update Failed", description: "Insufficient permissions." });
    }
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
          <p className="text-muted-foreground">Manage global roles and granular user permission overrides.</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-bold text-lg">SECURITY LEVEL 4</Badge>
      </div>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="roles" className="gap-2"><Key className="h-4 w-4" /> Group Roles</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><UserCog className="h-4 w-4" /> User Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="pt-6">
          <div className="grid gap-6">
            {roles?.map((role) => (
              <Card key={role.id} className="overflow-hidden border-l-4 border-l-primary">
                <CardHeader className="bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black text-primary uppercase">{role.name}</CardTitle>
                      <CardDescription>Default permissions for {role.id} group.</CardDescription>
                    </div>
                    <Badge variant="secondary">ROLE ID: {role.id}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-0 border-t">
                    {PERMISSION_KEYS.map((key) => (
                      <div key={key} className="p-4 border-r border-b flex flex-col gap-2 items-center justify-center hover:bg-primary/5 transition-colors">
                        <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground text-center line-clamp-1">{key}</span>
                        <Switch 
                          checked={!!role.permissions?.[key]} 
                          onCheckedChange={() => handleToggleRolePermission(role.id, key, !!role.permissions?.[key])}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Button variant="outline" className="border-dashed h-20 text-lg font-bold">
              <Plus className="mr-2 h-5 w-5" /> Create New Custom Role
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="users" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Employee Permission Registry</CardTitle>
              <CardDescription>Bypass role defaults by setting specific user-level overrides.</CardDescription>
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
                        <Badge variant="outline">{u.roleId || 'No Role'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(u.customPermissions || {}).map(k => (
                            <Badge key={k} className={u.customPermissions[k] ? "bg-emerald-500" : "bg-destructive"}>
                              {k}: {u.customPermissions[k] ? "ON" : "OFF"}
                            </Badge>
                          ))}
                          {(!u.customPermissions || Object.keys(u.customPermissions).length === 0) && (
                            <span className="text-xs text-muted-foreground italic">Using role defaults</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toast({ title: "Editor Mode", description: "Select a key to toggle override for this user." })}>
                          Edit Flags
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
              <p>Prefer group roles over user overrides whenever possible. Overrides are intended for temporary access or specialized technical accounts.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
