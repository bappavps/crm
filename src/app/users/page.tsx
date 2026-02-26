"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserPlus, 
  Shield, 
  Loader2, 
  Mail, 
  User as UserIcon, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Plus, 
  Key, 
  CheckCircle2, 
  Lock,
  ShoppingCart,
  Boxes,
  Factory,
  Settings,
  Palette,
  ShoppingBag,
  LineChart,
  LayoutDashboard,
  ShieldAlert,
  History,
  RotateCcw
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"
import { Switch } from "@/components/ui/switch"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, serverTimestamp, query, where, getDocs } from "firebase/firestore"
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

/**
 * MASTER PERMISSION REGISTRY
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
  "System Administration"
];

const ALL_SYSTEM_KEYS = Object.keys(PERMISSION_METADATA);

const formatLabel = (key: string) => {
  const acronyms = ["GRN", "BOM", "QC"];
  return key
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(w => acronyms.includes(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export default function UserManagementPage() {
  const { toast } = useToast()
  const { user: currentUser } = useUser()
  const firestore = useFirestore()
  
  // States
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editingRole, setEditingRole] = useState<any>(null)
  const [userToDelete, setUserToDelete] = useState<any>(null)
  const [roleToDelete, setRoleToDelete] = useState<any>(null)
  const [roleUsageCount, setRoleUsageCount] = useState<number>(0)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({})

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !currentUser) return null;
    return doc(firestore, 'adminUsers', currentUser.uid);
  }, [firestore, currentUser]);
  const { data: adminData, isLoading: adminCheckLoading } = useDoc(adminDocRef);

  // Queries
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !currentUser || !adminData) return null;
    return collection(firestore, 'users');
  }, [firestore, currentUser, adminData])

  const rolesQuery = useMemoFirebase(() => {
    if (!firestore || !currentUser || !adminData) return null;
    return collection(firestore, 'roles');
  }, [firestore, currentUser, adminData])

  const { data: users, isLoading: usersLoading } = useCollection(usersQuery)
  const { data: roles, isLoading: rolesLoading } = useCollection(rolesQuery)

  // --- USER LOGIC ---

  const handleOpenUserDialog = (user?: any) => {
    setEditingUser(user || null)
    setSelectedRoles(user?.roles || (user?.roleId ? [user.roleId] : []))
    setIsUserDialogOpen(true)
  }

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !currentUser) return

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    
    const userId = editingUser?.id || crypto.randomUUID()
    const userData = {
      id: userId,
      email,
      firstName,
      lastName,
      roles: selectedRoles,
      isActive: editingUser ? editingUser.isActive : true,
      mustChangePassword: editingUser ? (editingUser.mustChangePassword || false) : true,
      updatedAt: new Date().toISOString(),
      ...(editingUser ? {} : { createdAt: new Date().toISOString() })
    }

    setDocumentNonBlocking(doc(firestore, 'users', userId), userData, { merge: true })

    // Marker collections for security rules
    const isNowAdmin = selectedRoles.includes('Admin')
    if (isNowAdmin) {
      setDocumentNonBlocking(doc(firestore, 'adminUsers', userId), { id: userId, email, roles: selectedRoles }, { merge: true })
    } else {
      deleteDocumentNonBlocking(doc(firestore, 'adminUsers', userId))
    }

    setIsUserDialogOpen(false)
    toast({ title: editingUser ? "User Updated" : "User Created", description: `${firstName} saved successfully.` })
  }

  const handleToggleUserStatus = (user: any) => {
    if (!firestore) return
    const newStatus = !user.isActive
    updateDocumentNonBlocking(doc(firestore, 'users', user.id), {
      isActive: newStatus,
      updatedAt: new Date().toISOString()
    })
    toast({
      title: newStatus ? "Account Activated" : "Account Deactivated",
      description: `${user.firstName}'s access has been ${newStatus ? 'restored' : 'suspended'}.`
    })
  }

  const handleResetPassword = (user: any) => {
    // In this prototype, we just set the mustChangePassword flag
    if (!firestore) return
    updateDocumentNonBlocking(doc(firestore, 'users', user.id), {
      mustChangePassword: true,
      updatedAt: new Date().toISOString()
    })
    toast({
      title: "Password Reset Triggered",
      description: `${user.firstName} will be required to change their password on next login.`
    })
  }

  const handleDeleteUser = () => {
    if (!firestore || !userToDelete) return
    deleteDocumentNonBlocking(doc(firestore, 'users', userToDelete.id))
    deleteDocumentNonBlocking(doc(firestore, 'adminUsers', userToDelete.id))
    setUserToDelete(null)
    toast({ title: "User Deleted", description: "Account removed." })
  }

  // --- ROLE LOGIC ---

  const handleOpenRoleDialog = (role?: any) => {
    setEditingRole(role || null)
    setRolePermissions(role?.permissions || {})
    setIsRoleDialogOpen(true)
  }

  const handleSaveRole = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !currentUser) return

    const formData = new FormData(e.currentTarget)
    const name = formData.get("roleName") as string
    const roleId = editingRole?.id || name.replace(/\s+/g, '')

    const roleData = {
      id: roleId,
      name,
      permissions: rolePermissions,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    }

    setDocumentNonBlocking(doc(firestore, 'roles', roleId), roleData, { merge: true })
    setIsRoleDialogOpen(false)
    toast({ title: "Role Saved", description: `${name} role updated.` })
  }

  const handleOpenDeleteRole = async (role: any) => {
    if (role.id === 'Admin') {
      toast({ variant: "destructive", title: "Protected Role", description: "System Administrator role cannot be deleted." })
      return
    }

    // Check usage
    const q = query(collection(firestore, 'users'), where("roles", "array-contains", role.id))
    const snapshot = await getDocs(q)
    setRoleUsageCount(snapshot.size)
    setRoleToDelete(role)
  }

  const handleDeleteRoleConfirm = () => {
    if (!firestore || !roleToDelete) return
    deleteDocumentNonBlocking(doc(firestore, 'roles', roleToDelete.id))
    setRoleToDelete(null)
    toast({ title: "Role Removed", description: "System role has been deleted." })
  }

  const categorizedPermissions = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    ALL_SYSTEM_KEYS.forEach(key => {
      const group = PERMISSION_METADATA[key].group;
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(key);
    });
    return grouped;
  }, []);

  if (adminCheckLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin" /></div>
  if (!adminData) return <div className="p-20 text-center">Access Denied.</div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary">Administration Center</h2>
          <p className="text-muted-foreground font-medium">Unified management for employees, roles, and granular security.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleOpenRoleDialog()} className="border-primary/20 hover:bg-primary/5">
            <Shield className="mr-2 h-4 w-4" /> Create New Role
          </Button>
          <Button onClick={() => handleOpenUserDialog()} className="bg-primary hover:bg-primary/90 shadow-lg">
            <UserPlus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-xl w-fit">
          <TabsTrigger value="users" className="gap-2 px-6 font-bold">
            <UserIcon className="h-4 w-4" /> User Directory
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 px-6 font-bold">
            <Key className="h-4 w-4" /> System Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="pt-6">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-black text-[10px] uppercase">Employee</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Assigned Roles</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Access Status</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Security</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : users?.map((u) => (
                    <TableRow key={u.id} className={`hover:bg-muted/10 ${!u.isActive ? 'opacity-60 grayscale' : ''}`}>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border-2 border-primary/10">
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">
                              {u.firstName?.[0]}{u.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-black text-sm">{u.firstName} {u.lastName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{u.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {(u.roles || (u.roleId ? [u.roleId] : [])).map((r: string) => (
                            <Badge key={r} variant="secondary" className="text-[9px] font-black uppercase tracking-tighter border-primary/10">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={!!u.isActive} 
                            onCheckedChange={() => handleToggleUserStatus(u)} 
                          />
                          <Badge className={u.isActive ? 'bg-emerald-500' : 'bg-muted'}>
                            {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.mustChangePassword && (
                          <Badge variant="outline" className="text-accent border-accent bg-accent/5 animate-pulse">
                            <ShieldAlert className="h-3 w-3 mr-1" /> RESET REQ.
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleOpenUserDialog(u)}><Pencil className="mr-2 h-4 w-4" /> Edit Profile</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(u)}><RotateCcw className="mr-2 h-4 w-4" /> Reset Password</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setUserToDelete(u)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Account</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles?.map((role) => (
              <Card key={role.id} className="group hover:border-primary/50 transition-all shadow-md overflow-hidden relative">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-primary/10 rounded-lg"><Shield className="h-5 w-5 text-primary" /></div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenRoleDialog(role)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleOpenDeleteRole(role)} 
                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={role.id === 'Admin'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-black pt-2 uppercase tracking-tight">{role.name}</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground">{Object.values(role.permissions || {}).filter(v => v === true).length} ACTIVE PERMISSIONS</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-1.5">
                    {GROUP_ORDER.map(group => {
                      const activeInGroup = (categorizedPermissions[group] || []).filter(k => role.permissions?.[k]).length;
                      if (activeInGroup === 0) return null;
                      return (
                        <Badge key={group} variant="outline" className="text-[9px] font-black uppercase">
                          {group.split(' ')[0]}: {activeInGroup}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* --- ROLE DIALOG --- */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <form onSubmit={handleSaveRole} className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-6 pb-2 shrink-0 border-b bg-background">
              <DialogTitle className="text-xl font-black uppercase">
                {editingRole ? 'Edit System Role' : 'Create New System Role'}
              </DialogTitle>
              <DialogDescription className="font-medium">Define group-level capabilities for operational modules.</DialogDescription>
            </DialogHeader>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-thin bg-background/50">
              <div className="space-y-2">
                <Label htmlFor="roleName" className="text-xs font-black uppercase">Role Name</Label>
                <Input id="roleName" name="roleName" defaultValue={editingRole?.name} placeholder="e.g. Accounts Manager" required />
              </div>

              <div className="space-y-4">
                <Label className="text-xs font-black uppercase text-primary">Operational Permissions</Label>
                <Accordion type="multiple" className="w-full space-y-2">
                  {GROUP_ORDER.map((group) => (
                    <AccordionItem key={group} value={group} className="border rounded-lg px-4 bg-muted/20">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3">
                          {categorizedPermissions[group] && <div className="p-1.5 bg-primary/5 rounded"><CheckCircle2 className="h-4 w-4 text-primary" /></div>}
                          <span className="text-sm font-black uppercase tracking-tight">{group}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(categorizedPermissions[group] || []).map((key) => (
                            <div key={key} className="flex items-center justify-between p-2 rounded-md bg-background border border-border/50">
                              <span className="text-[11px] font-bold">{formatLabel(key)}</span>
                              <Switch 
                                checked={!!rolePermissions[key]} 
                                onValueChange={(val) => setRolePermissions(p => ({...p, [key]: val}))} 
                              />
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>

            <DialogFooter className="p-6 bg-muted/30 border-t shrink-0">
              <Button type="submit" className="w-full font-black uppercase tracking-widest">{editingRole ? 'Update Role' : 'Initialize Role'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- USER DIALOG --- */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveUser}>
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase">{editingUser ? 'Edit Profile' : 'New Employee Entry'}</DialogTitle>
              <DialogDescription className="font-medium">Assign multiple system roles to this employee.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">First Name</Label>
                  <Input name="firstName" defaultValue={editingUser?.firstName} required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Last Name</Label>
                  <Input name="lastName" defaultValue={editingUser?.lastName} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Work Email</Label>
                <Input name="email" type="email" defaultValue={editingUser?.email} required />
              </div>
              
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-primary">Assign System Roles</Label>
                <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/20">
                  {roles?.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`role-${role.id}`} 
                        checked={selectedRoles.includes(role.id)} 
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedRoles(p => [...p, role.id]);
                          else setSelectedRoles(p => p.filter(id => id !== role.id));
                        }}
                      />
                      <label htmlFor={`role-${role.id}`} className="text-xs font-bold leading-none cursor-pointer">{role.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              {!editingUser && (
                <div className="p-4 bg-primary/5 border border-dashed rounded-lg">
                  <p className="text-[10px] font-bold text-primary uppercase mb-1 flex items-center gap-1">
                    <History className="h-3 w-3" /> Security Policy
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    A temporary password will be assigned (<strong>admin@123</strong>). The user will be required to change it upon their first successful login.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full font-black uppercase">Save Employee Profile</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE USER CONFIRM */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">This will permanently remove access for {userToDelete?.firstName}. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">Delete Account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DELETE ROLE CONFIRM */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase">
              {roleUsageCount > 0 ? 'Role Blocked' : 'Confirm Role Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              {roleUsageCount > 0 
                ? `This role is currently assigned to ${roleUsageCount} users. Please reassign those employees to other roles before deleting this system definition.`
                : `Are you sure you want to delete the "${roleToDelete?.name}" role? This will remove these specific permission defaults from the system.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {roleUsageCount === 0 && (
              <AlertDialogAction onClick={handleDeleteRoleConfirm} className="bg-destructive hover:bg-destructive/90">Delete Role</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
