
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserPlus, Shield, Loader2, Mail, User as UserIcon } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function UserManagementPage() {
  const { toast } = useToast()
  const { user: currentUser } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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

  const handleAddUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !currentUser) return

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    const roleId = formData.get("roleId") as string
    
    // In a real app, you'd use Firebase Auth to create the user.
    // For this prototype, we'll create the database record.
    const newUserId = crypto.randomUUID()
    const userData = {
      id: newUserId,
      username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
      email,
      firstName,
      lastName,
      roleId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 1. Create the user profile
    setDocumentNonBlocking(doc(firestore, 'users', newUserId), userData, { merge: true })

    // 2. Create the role marker document for DBAC
    const roleColMap: Record<string, string> = {
      'Admin': 'adminUsers',
      'Manager': 'managerUsers',
      'Operator': 'operatorUsers'
    }
    
    const roleCollection = roleColMap[roleId]
    if (roleCollection) {
      setDocumentNonBlocking(doc(firestore, roleCollection, newUserId), {
        id: newUserId,
        email,
        roleId,
        isActive: true,
        createdAt: new Date().toISOString()
      }, { merge: true })
    }

    setIsDialogOpen(false)
    toast({
      title: "User Created",
      description: `${firstName} ${lastName} has been added as ${roleId}.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">User Management</h2>
          <p className="text-muted-foreground">Manage employee access, roles, and permissions.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddUser}>
            <DialogHeader>
              <DialogTitle>Add New System User</DialogTitle>
              <DialogDescription>Create a profile and assign a specialized ERP role.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" placeholder="John" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" placeholder="Doe" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" placeholder="john.doe@shreelabel.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="roleId">System Role</Label>
                <Select name="roleId" defaultValue="Operator">
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
              <Button type="submit">Create Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                    <Button variant="ghost" size="sm" onClick={() => toast({ title: "Profile Management", description: "Loading user audit logs..." })}>
                      Edit
                    </Button>
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
