"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog"
import { Settings, Users, Database, Box, Plus, TrendingUp, Ruler, Truck, Trash2, Pencil, ShieldCheck } from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { usePermissions } from "@/components/auth/permission-context"
import { Switch } from "@/components/ui/switch"

export default function MasterDataPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"materials" | "machines" | "customers" | "cylinders" | "suppliers">("materials")
  const [editingItem, setEditingItem] = useState<any>(null)

  // Wait for the user to have their Admin role document ready before fetching protected collections
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries
  const materialsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'materials');
  }, [firestore, user, adminData])

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'machines');
  }, [firestore, user, adminData])

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'customers');
  }, [firestore, user, adminData])

  const cylindersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'cylinders');
  }, [firestore, user, adminData])

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user, adminData])

  const { data: materials, isLoading: materialsLoading } = useCollection(materialsQuery)
  const { data: machines, isLoading: machinesLoading } = useCollection(machinesQuery)
  const { data: customers, isLoading: customersLoading } = useCollection(customersQuery)
  const { data: cylinders, isLoading: cylindersLoading } = useCollection(cylindersQuery)
  const { data: suppliers, isLoading: suppliersLoading } = useCollection(suppliersQuery)

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())
    
    if (!firestore || !user) return

    // Explicitly handle isActive for customers
    if (dialogType === 'customers') {
      (data as any).isActive = (data as any).isActive === 'on';
    }

    if (editingItem) {
      const itemRef = doc(firestore, dialogType, editingItem.id)
      updateDocumentNonBlocking(itemRef, {
        ...data,
        updatedAt: new Date().toISOString(),
        updatedById: user.uid
      })
      toast({
        title: "Record Updated",
        description: `Changes to ${data.name || 'item'} have been saved.`,
      })
    } else {
      const colRef = collection(firestore, dialogType)
      addDocumentNonBlocking(colRef, {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        createdById: user.uid,
        ...(dialogType === 'customers' ? { isActive: true } : {})
      })
      toast({
        title: "Master Data Updated",
        description: `New ${dialogType.slice(0, -1)} has been added successfully.`,
      })
    }

    setIsDialogOpen(false)
    setEditingItem(null)
  }

  const handleDelete = (type: string, id: string, name: string) => {
    if (!firestore) return
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteDocumentNonBlocking(doc(firestore, type, id))
      toast({
        title: "Record Deleted",
        description: `${name} has been removed from master data.`
      })
    }
  }

  const openAddDialog = (type: "materials" | "machines" | "customers" | "cylinders" | "suppliers") => {
    setDialogType(type)
    setEditingItem(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (type: "materials" | "machines" | "customers" | "cylinders" | "suppliers", item: any) => {
    setDialogType(type)
    setEditingItem(item)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Master Data Management</h2>
          <p className="text-muted-foreground">Configure global constants, materials, machines, and industry rates.</p>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) setEditingItem(null)
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add New'} {dialogType.charAt(0).toUpperCase() + dialogType.slice(1, -1)}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {(dialogType === "materials") && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" className="col-span-3" defaultValue={editingItem?.name} placeholder="e.g. Chromo, PP White" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gsm" className="text-right">GSM</Label>
                    <Input id="gsm" name="gsm" type="number" className="col-span-3" defaultValue={editingItem?.gsm} required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ratePerSqMeter" className="text-right">Rate/sqm</Label>
                    <Input id="ratePerSqMeter" name="ratePerSqMeter" type="number" step="0.01" className="col-span-3" defaultValue={editingItem?.ratePerSqMeter} required />
                  </div>
                </>
              )}
              {dialogType === "machines" && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" className="col-span-3" defaultValue={editingItem?.name} required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="maxPrintingWidthMm" className="text-right">Max Width</Label>
                    <Input id="maxPrintingWidthMm" name="maxPrintingWidthMm" type="number" className="col-span-3" defaultValue={editingItem?.maxPrintingWidthMm} required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="costPerHour" className="text-right">Cost/hr</Label>
                    <Input id="costPerHour" name="costPerHour" type="number" className="col-span-3" defaultValue={editingItem?.costPerHour} required />
                  </div>
                </>
              )}
              {(dialogType === "customers" || dialogType === "suppliers") && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Company</Label>
                    <Input id="name" name="name" className="col-span-3" defaultValue={editingItem?.name} required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gstNumber" className="text-right">GST No.</Label>
                    <Input id="gstNumber" name="gstNumber" className="col-span-3" defaultValue={editingItem?.gstNumber} required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" name="email" type="email" className="col-span-3" defaultValue={editingItem?.email} required />
                  </div>
                  {dialogType === "customers" && hasPermission('client_credit_edit') && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="creditPeriod" className="text-right">Credit (Days)</Label>
                      <Input id="creditPeriod" name="creditPeriod" type="number" className="col-span-3" defaultValue={editingItem?.creditPeriod} placeholder="e.g. 30" />
                    </div>
                  )}
                  {dialogType === "customers" && editingItem && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="isActive" className="text-right">Active Status</Label>
                      <div className="col-span-3 flex items-center gap-2">
                        <Switch id="isActive" name="isActive" defaultChecked={editingItem?.isActive !== false} />
                        <span className="text-xs text-muted-foreground">{editingItem?.isActive !== false ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              {dialogType === "cylinders" && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" className="col-span-3" defaultValue={editingItem?.name} placeholder="e.g. Cyl 508" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="repeatLengthMm" className="text-right">Repeat (mm)</Label>
                    <Input id="repeatLengthMm" name="repeatLengthMm" type="number" className="col-span-3" defaultValue={editingItem?.repeatLengthMm} required />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Create Record'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-[1000px]">
          <TabsTrigger value="materials" className="flex items-center gap-2 text-xs lg:text-sm"><Database className="h-4 w-4" /> Materials</TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2 text-xs lg:text-sm"><Truck className="h-4 w-4" /> Suppliers</TabsTrigger>
          <TabsTrigger value="machines" className="flex items-center gap-2 text-xs lg:text-sm"><Box className="h-4 w-4" /> Machines</TabsTrigger>
          <TabsTrigger value="cylinders" className="flex items-center gap-2 text-xs lg:text-sm"><Ruler className="h-4 w-4" /> Cylinders</TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2 text-xs lg:text-sm"><Users className="h-4 w-4" /> Clients</TabsTrigger>
          <TabsTrigger value="rates" className="flex items-center gap-2 text-xs lg:text-sm"><TrendingUp className="h-4 w-4" /> Rates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="materials" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Material Registry (Substrates)</CardTitle>
              <Button size="sm" onClick={() => openAddDialog("materials")}><Plus className="h-4 w-4 mr-2" /> Add Material</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Substrate Name</TableHead>
                    <TableHead>GSM</TableHead>
                    <TableHead>Price (₹/sqm)</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.gsm}</TableCell>
                      <TableCell>₹{m.ratePerSqMeter}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog("materials", m)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete("materials", m.id, m.name)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!materials || materials.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {materialsLoading ? "Loading..." : "No materials found. Click Add to create one."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Supplier Master (Paper Companies)</CardTitle>
              <Button size="sm" onClick={() => openAddDialog("suppliers")}><Plus className="h-4 w-4 mr-2" /> Add Company</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>GST Number</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.gstNumber}</TableCell>
                      <TableCell className="text-xs">{s.email}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog("suppliers", s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete("suppliers", s.id, s.name)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!suppliers || suppliers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {suppliersLoading ? "Loading..." : "No suppliers found. Click Add to create one."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="machines" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Machine Configuration</CardTitle>
              <Button size="sm" onClick={() => openAddDialog("machines")}><Plus className="h-4 w-4 mr-2" /> Add Machine</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine Name</TableHead>
                    <TableHead>Max Width</TableHead>
                    <TableHead>Cost/hr</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machines?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.maxPrintingWidthMm}mm</TableCell>
                      <TableCell>₹{m.costPerHour}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog("machines", m)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete("machines", m.id, m.name)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!machines || machines.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {machinesLoading ? "Loading..." : "No machines found. Click Add to create one."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cylinders" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Cylinder Library</CardTitle>
              <Button size="sm" onClick={() => openAddDialog("cylinders")}><Plus className="h-4 w-4 mr-2" /> Add Cylinder</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Repeat Length</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cylinders?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.repeatLengthMm}mm</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog("cylinders", c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete("cylinders", c.id, c.name)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!cylinders || cylinders.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        {cylindersLoading ? "Loading..." : "No cylinders found. Click Add to create one."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Customer Master</CardTitle>
              {hasPermission('client_add') && (
                <Button size="sm" onClick={() => openAddDialog("customers")}><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>GST No.</TableHead>
                    <TableHead>Email</TableHead>
                    {hasPermission('client_credit_edit') && <TableHead>Credit (Days)</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers?.map((c) => (
                    <TableRow key={c.id} className={c.isActive === false ? 'opacity-60 grayscale' : ''}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.gstNumber}</TableCell>
                      <TableCell className="text-xs">{c.email}</TableCell>
                      {hasPermission('client_credit_edit') && <TableCell className="font-bold">{c.creditPeriod || '0'}</TableCell>}
                      <TableCell>
                        <Badge className={c.isActive !== false ? 'bg-emerald-500' : 'bg-muted'}>
                          {c.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        {hasPermission('client_edit') && (
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog("customers", c)}><Pencil className="h-4 w-4" /></Button>
                        )}
                        {hasPermission('client_delete') && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete("customers", c.id, c.name)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                        {!hasPermission('client_edit') && !hasPermission('client_delete') && (
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">View Only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!customers || customers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {customersLoading ? "Loading..." : "No customers found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-primary">Global Operation Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-primary/5">
                  <h4 className="font-bold text-primary mb-2">Printing Rate</h4>
                  <p className="text-2xl font-black">₹1.50 <span className="text-xs text-muted-foreground font-normal">/meter</span></p>
                </div>
                <div className="p-4 border rounded-lg bg-accent/5">
                  <h4 className="font-bold text-accent mb-2">UV Coating Rate</h4>
                  <p className="text-2xl font-black">₹0.50 <span className="text-xs text-muted-foreground font-normal">/meter</span></p>
                </div>
                <div className="p-4 border rounded-lg bg-emerald-50">
                  <h4 className="font-bold text-emerald-600 mb-2">Labor Rate</h4>
                  <p className="text-2xl font-black">₹500 <span className="text-xs text-muted-foreground font-normal">/hour</span></p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Standard Jumbo Width (mm)</label>
                    <Input defaultValue="1020" readOnly />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Default Side Margin (mm)</label>
                    <Input defaultValue="5" />
                  </div>
                </div>
                <Button className="mt-4" onClick={() => toast({title: "Settings Saved", description: "Global constants updated."})}>Update Configuration</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
