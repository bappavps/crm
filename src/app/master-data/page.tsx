"use client"

import { useState, useRef } from "react"
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
  DialogDescription
} from "@/components/ui/dialog"
import { 
  Settings, 
  Users, 
  Database, 
  Box, 
  Plus, 
  TrendingUp, 
  Ruler, 
  Truck, 
  Trash2, 
  Pencil, 
  ShieldCheck, 
  Eye, 
  Info, 
  Phone, 
  Mail, 
  Upload, 
  X,
  Globe,
  MapPin
} from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { usePermissions } from "@/components/auth/permission-context"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import Image from "next/image"

export default function MasterDataPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"materials" | "machines" | "customers" | "cylinders" | "suppliers">("materials")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [viewingItem, setViewingItem] = useState<any>(null)
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const rawData = Object.fromEntries(formData.entries())
    
    if (!firestore || !user) return

    let finalData: any = { ...rawData };

    // Standardize Customer Data
    if (dialogType === 'customers') {
      finalData = {
        clientPersonName: rawData.clientPersonName,
        companyName: rawData.companyName,
        fullAddress: rawData.fullAddress,
        whatsapp: rawData.whatsapp,
        email: rawData.email,
        website: rawData.website,
        gstNumber: rawData.gstNumber,
        operationalNote: rawData.operationalNote,
        creditDays: Number(rawData.creditDays) || 0,
        status: rawData.status === 'on' ? 'Active' : 'Inactive',
        photoUrl: photoPreview || editingItem?.photoUrl || null
      }
    }

    if (editingItem) {
      const itemRef = doc(firestore, dialogType, editingItem.id)
      updateDocumentNonBlocking(itemRef, {
        ...finalData,
        updatedAt: new Date().toISOString(),
        updatedById: user.uid
      })
      toast({ title: "Record Updated", description: `Changes have been saved.` })
    } else {
      const colRef = collection(firestore, dialogType)
      addDocumentNonBlocking(colRef, {
        ...finalData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        createdById: user.uid
      })
      toast({ title: "Master Data Updated", description: `New ${dialogType.slice(0, -1)} added successfully.` })
    }

    setIsDialogOpen(false)
    setEditingItem(null)
    setPhotoPreview(null)
  }

  const handleDelete = (type: string, id: string, name: string) => {
    if (!firestore) return
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteDocumentNonBlocking(doc(firestore, type, id))
      toast({ title: "Record Deleted", description: `${name} has been removed.` })
    }
  }

  const openAddDialog = (type: typeof dialogType) => {
    setDialogType(type)
    setEditingItem(null)
    setPhotoPreview(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (type: typeof dialogType, item: any) => {
    setDialogType(type)
    setEditingItem(item)
    setPhotoPreview(item.photoUrl || null)
    setIsDialogOpen(true)
  }

  const openDetails = (item: any) => {
    setViewingItem(item)
    setIsDetailsOpen(true)
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
        if (!open) { setEditingItem(null); setPhotoPreview(null); }
      }}>
        <DialogContent className={dialogType === 'customers' ? "sm:max-w-[700px] max-h-[90vh] overflow-y-auto" : "sm:max-w-[425px]"}>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add New'} {dialogType.charAt(0).toUpperCase() + dialogType.slice(1, -1)}</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {dialogType === "customers" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input id="companyName" name="companyName" defaultValue={editingItem?.companyName} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientPersonName">Contact Person</Label>
                      <Input id="clientPersonName" name="clientPersonName" defaultValue={editingItem?.clientPersonName} required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullAddress">Full Address</Label>
                    <Textarea id="fullAddress" name="fullAddress" defaultValue={editingItem?.fullAddress} required />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input id="whatsapp" name="whatsapp" defaultValue={editingItem?.whatsapp} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" defaultValue={editingItem?.email} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gstNumber">GST Number</Label>
                      <Input id="gstNumber" name="gstNumber" defaultValue={editingItem?.gstNumber} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input id="website" name="website" defaultValue={editingItem?.website} />
                      </div>
                      {hasPermission('client_credit_edit') && (
                        <div className="space-y-2">
                          <Label htmlFor="creditDays">Credit Period (Days)</Label>
                          <Input id="creditDays" name="creditDays" type="number" defaultValue={editingItem?.creditDays || 0} />
                        </div>
                      )}
                      <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
                        <Label htmlFor="status">Account Active</Label>
                        <Switch id="status" name="status" defaultChecked={editingItem ? (editingItem.status === 'Active' || editingItem.isActive !== false) : true} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Client Photo / Logo</Label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-2 p-4 border rounded-md bg-muted/20 border-dashed cursor-pointer hover:bg-muted/40 transition-colors relative h-32"
                      >
                        {photoPreview ? (
                          <div className="relative w-full h-full">
                            <Image src={photoPreview} alt="Preview" fill className="object-contain" />
                            <Button 
                              type="button" 
                              variant="destructive" 
                              size="icon" 
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                              onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground uppercase font-bold text-center">Upload Photo</span>
                          </>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoSelect} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="operationalNote">Operational Note</Label>
                    <Input id="operationalNote" name="operationalNote" defaultValue={editingItem?.operationalNote} placeholder="Internal notes..." />
                  </div>
                </div>
              ) : dialogType === "materials" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Material Name</Label>
                    <Input id="name" name="name" defaultValue={editingItem?.name} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gsm">GSM</Label>
                      <Input id="gsm" name="gsm" type="number" defaultValue={editingItem?.gsm} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ratePerSqMeter">Rate/sqm</Label>
                      <Input id="ratePerSqMeter" name="ratePerSqMeter" type="number" step="0.01" defaultValue={editingItem?.ratePerSqMeter} required />
                    </div>
                  </div>
                </>
              ) : dialogType === "machines" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Machine Name</Label>
                    <Input id="name" name="name" defaultValue={editingItem?.name} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxPrintingWidthMm">Max Width (mm)</Label>
                      <Input id="maxPrintingWidthMm" name="maxPrintingWidthMm" type="number" defaultValue={editingItem?.maxPrintingWidthMm} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="costPerHour">Cost/hr (₹)</Label>
                      <Input id="costPerHour" name="costPerHour" type="number" defaultValue={editingItem?.costPerHour} required />
                    </div>
                  </div>
                </>
              ) : dialogType === "suppliers" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Company Name</Label>
                    <Input id="name" name="name" defaultValue={editingItem?.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">GST Number</Label>
                    <Input id="gstNumber" name="gstNumber" defaultValue={editingItem?.gstNumber} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={editingItem?.email} required />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" defaultValue={editingItem?.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repeatLengthMm">Repeat Length (mm)</Label>
                    <Input id="repeatLengthMm" name="repeatLengthMm" type="number" defaultValue={editingItem?.repeatLengthMm} required />
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">{editingItem ? 'Save Changes' : 'Create Record'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Viewing Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Client Specification
            </DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg">
                <div className="relative h-16 w-16 rounded-full overflow-hidden border bg-background flex items-center justify-center">
                  {viewingItem.photoUrl ? (
                    <Image src={viewingItem.photoUrl} alt="Logo" fill className="object-cover" />
                  ) : (
                    <Users className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{viewingItem.companyName}</h3>
                  <p className="text-sm text-muted-foreground">{viewingItem.clientPersonName}</p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground font-bold uppercase text-[10px]">GST Number</span>
                  <span className="col-span-2 font-mono">{viewingItem.gstNumber}</span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <span className="text-muted-foreground font-bold uppercase text-[10px] flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Registered Address
                  </span>
                  <p className="leading-relaxed bg-muted/30 p-3 rounded">{viewingItem.fullAddress}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-muted-foreground font-bold uppercase text-[10px] flex items-center gap-1">
                    <Info className="h-3 w-3" /> Operational Notes
                  </span>
                  <p className="italic text-muted-foreground bg-muted/30 p-3 rounded">{viewingItem.operationalNote || "No notes recorded."}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsDetailsOpen(false)}>Close Summary</Button>
          </DialogFooter>
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
                    <TableHead>Contact Person</TableHead>
                    <TableHead>GST No.</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Email</TableHead>
                    {hasPermission('client_credit_edit') && <TableHead>Credit (Days)</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customersLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : customers?.map((c) => (
                    <TableRow key={c.id} className={c.status === 'Inactive' || c.isActive === false ? 'opacity-60 grayscale' : ''}>
                      <TableCell className="font-bold text-primary">{c.companyName}</TableCell>
                      <TableCell className="text-xs">{c.clientPersonName}</TableCell>
                      <TableCell className="font-mono text-[10px]">{c.gstNumber}</TableCell>
                      <TableCell className="text-xs flex items-center gap-1"><Phone className="h-3 w-3 text-emerald-600" /> {c.whatsapp}</TableCell>
                      <TableCell className="text-xs">{c.email}</TableCell>
                      {hasPermission('client_credit_edit') && <TableCell className="font-bold">{c.creditDays || 0}</TableCell>}
                      <TableCell>
                        <Badge className={(c.status === 'Active' || c.isActive !== false) ? 'bg-emerald-500' : 'bg-muted'}>
                          {(c.status === 'Active' || c.isActive !== false) ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openDetails(c)}><Eye className="h-4 w-4" /></Button>
                        {hasPermission('client_edit') && (
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog("customers", c)}><Pencil className="h-4 w-4" /></Button>
                        )}
                        {hasPermission('client_delete') && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete("customers", c.id, c.companyName)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
