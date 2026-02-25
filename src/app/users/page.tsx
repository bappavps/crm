
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserPlus, Shield, Loader2, Mail, User as UserIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, deleteDoc } from "firebase/firestore"
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function UserManagementPage() {
  const { toast } = useToast()
  const { user: currentUser } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [userToDelete, setUserToDelete] = useState<any>(null)

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !currentUser) return null;
    return doc(firestore, 'adminUsers', currentUser.uid);
  }, [firestore, currentUser]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Query
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !currentUser || !adminData) return null;
    return collection(firestore, 'users');
  }, [firestore, currentUser, adminData])

  const { data: users, isLoading } = useCollection(usersQuery)

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !currentUser) return

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    const roleId = formData.get("roleId") as string
    
    const userId = editingUser?.id || crypto.randomUUID()
    const userData = {
      id: userId,
      username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
      email,
      firstName,
      lastName,
      roleId,
      isActive: editingUser ? editingUser.isActive : true,
      updatedAt: new Date().toISOString(),
      ...(editingUser ? {} : { createdAt: new Date().toISOString() })
    }

    setDocumentNonBlocking(doc(firestore, 'users', userId), userData, { merge: true })

    // If role changed, cleanup old role and add new role
    if (editingUser && editingUser.roleId !== roleId) {
      const oldRoleCol = roleColMap[editingUser.roleId]
      if (oldRoleCol) {
        deleteDocumentNonBlocking(doc(firestore, oldRoleCol, userId))
      }
    }

    const roleCollection = roleColMap[roleId]
    if (roleCollection) {
      setDocumentNonBlocking(doc(firestore, roleCollection, userId), {
        id: userId,
        email,
        roleId,
        isActive: userData.isActive,
        createdAt: new Date().toISOString()
      }, { merge: true })
    }

    setIsDialogOpen(false)
    setEditingUser(null)
    toast({
      title: editingUser ? "User Updated" : "User Created",
      description: `${firstName} ${lastName} has been saved as ${roleId}.`
    })
  }

  const roleColMap: Record<string, string> = {
    'Admin': 'adminUsers',
    'Manager': 'managerUsers',
    'Operator': 'operatorUsers'
  }

  const toggleUserStatus = (userId: string, currentStatus: boolean) => {
    if (!firestore) return
    const userRef = doc(firestore, 'users', userId)
    updateDocumentNonBlocking(userRef, { isActive: !currentStatus })
    toast({
      title: "User Status Updated",
      description: `User account has been ${!currentStatus ? 'activated' : 'deactivated'}.`
    })
  }

  const handleDeleteUser = () => {
    if (!firestore || !userToDelete) return

    // 1. Delete from main collection
    deleteDocumentNonBlocking(doc(firestore, 'users', userToDelete.id))

    // 2. Delete from role-specific collection
    const roleCol = roleColMap[userToDelete.roleId]
    if (roleCol) {
      deleteDocumentNonBlocking(doc(firestore, roleCol, userToDelete.id))
    }

    setUserToDelete(null)
    toast({
      title: "User Deleted",
      description: "The employee account has been removed from the system."
    })
  }

  const openEditDialog = (user: any) => {
    setEditingUser(user)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">User Management</h2>
          <p className="text-muted-foreground">Manage employee access, roles, and permissions.</p>
        </div>
        <Button onClick={() => { setEditingUser(null); setIsDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSaveUser}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit System User' : 'Add New System User'}</DialogTitle>
              <DialogDescription>
                {editingUser ? `Updating profile for ${editingUser.firstName} ${editingUser.lastName}.` : 'Create a profile and assign a specialized ERP role.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" defaultValue={editingUser?.firstName} placeholder="John" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" defaultValue={editingUser?.lastName} placeholder="Doe" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" defaultValue={editingUser?.email} placeholder="john.doe@shreelabel.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="roleId">System Role</Label>
                <Select name="roleId" defaultValue={editingUser?.roleId || "Operator"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin (Full Access)</SelectItem>
                    <SelectItem value="Manager">Manager (Reports & Planning)</SelectItem>
                    <SelectItem value="Operator">Operator (Floor & Inventory)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingUser ? 'Save Changes' : 'Create Account'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the account for <strong>{userToDelete?.firstName} {userToDelete?.lastName}</strong> and remove their access to the ERP system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Active System Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Fetching user accounts...
                  </TableCell>
                </TableRow>
              ) : users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{u.firstName} {u.lastName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{u.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {u.roleId}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      {u.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={u.isActive ? 'bg-emerald-500' : 'bg-muted text-muted-foreground'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(u)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleUserStatus(u.id, u.isActive)}>
                          <Shield className="mr-2 h-4 w-4" /> {u.isActive ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setUserToDelete(u)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!users || users.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <UserIcon className="h-8 w-8 opacity-20" />
                      <p>No user records found. Use "Add User" to register employees.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
