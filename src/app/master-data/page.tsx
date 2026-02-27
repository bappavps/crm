"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  MapPin,
  Loader2,
  FlaskConical,
  Layers,
  ChevronRight
} from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { usePermissions } from "@/components/auth/permission-context"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"

export default function MasterDataPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"materials" | "machines" | "customers" | "cylinders" | "suppliers" | "raw_materials" | "boms">("materials")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [viewingItem, setViewingItem] = useState<any>(null)
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // BOM Materials Local State
  const [bomMaterials, setBomMaterials] = useState<any[]>([])

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

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'raw_materials');
  }, [firestore, user, adminData])

  const bomsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'boms');
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

  const { data: materials } = useCollection(materialsQuery)
  const { data: rawMaterials, isLoading: rawLoading } = useCollection(rawMaterialsQuery)
  const { data: boms, isLoading: bomsLoading } = useCollection(bomsQuery)
  const { data: machines } = useCollection(machinesQuery)
  const { data: customers, isLoading: customersLoading } = useCollection(customersQuery)
  const { data: cylinders } = useCollection(cylindersQuery)
  const { data: suppliers } = useCollection(suppliersQuery)

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

    // Handle Custom Logic per Type
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
        outstandingAmount: Number(rawData.outstandingAmount) || 0,
        creditLimit: Number(rawData.creditLimit) || 0,
        status: rawData.status === 'on' ? 'Active' : 'Inactive',
        isCreditBlocked: rawData.isCreditBlocked === 'on',
        photoUrl: photoPreview || editingItem?.photoUrl || null
      }
    } else if (dialogType === 'raw_materials') {
      finalData = {
        name: rawData.name,
        category: rawData.category,
        unit: rawData.unit,
        rate_per_unit: Number(rawData.rate_per_unit),
        is_composite: rawData.is_composite === 'on',
        active: true
      }
    } else if (dialogType === 'boms') {
      finalData = {
        product_name: rawData.product_name,
        materials: bomMaterials,
        updatedAt: new Date().toISOString()
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
    setBomMaterials([])
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
    setBomMaterials([])
    setIsDialogOpen(true)
  }

  const openEditDialog = (type: typeof dialogType, item: any) => {
    setDialogType(type)
    setEditingItem(item)
    setPhotoPreview(item.photoUrl || null)
    if (type === 'boms') setBomMaterials(item.materials || [])
    setIsDialogOpen(true)
  }

  const addBomMaterial = () => {
    setBomMaterials([...bomMaterials, { material_id: "", consumption_type: "per_1000", consumption_value: 0, wastage_percent: 5 }])
  }

  const removeBomMaterial = (index: number) => {
    setBomMaterials(bomMaterials.filter((_, i) => i !== index))
  }

  const updateBomMaterial = (index: number, field: string, value: any) => {
    const updated = [...bomMaterials]
    updated[index] = { ...updated[index], [field]: value }
    setBomMaterials(updated)
  }

  const openDetails = (c: any) => {
    setViewingItem(c)
    setIsDetailsOpen(true)
  }

  const checkIsOverdue = (c: any) => {
    if (!c.lastInvoiceDate || !c.creditDays) return false
    const lastInvoice = new Date(c.lastInvoiceDate)
    const dueDate = new Date(lastInvoice.getTime() + c.creditDays * 24 * 60 * 60 * 1000)
    return new Date() > dueDate
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
        if (!open) { setEditingItem(null); setPhotoPreview(null); setBomMaterials([]); }
      }}>
        <DialogContent className={dialogType === 'customers' || dialogType === 'boms' ? "sm:max-w-[700px] max-h-[90vh] overflow-y-auto" : "sm:max-w-[425px]"}>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add New'} {dialogType.charAt(0).toUpperCase() + dialogType.replace(/_/g, ' ').slice(1, -1)}</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {dialogType === "raw_materials" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Material Name</Label>
                    <Input id="name" name="name" defaultValue={editingItem?.name} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select name="category" defaultValue={editingItem?.category || "paper"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paper">Paper</SelectItem>
                          <SelectItem value="ink">Ink</SelectItem>
                          <SelectItem value="uv">UV / Varnish</SelectItem>
                          <SelectItem value="lamination">Lamination</SelectItem>
                          <SelectItem value="misc">Miscellaneous</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Select name="unit" defaultValue={editingItem?.unit || "sqm"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sqm">SQM</SelectItem>
                          <SelectItem value="kg">KG</SelectItem>
                          <SelectItem value="meter">Meter</SelectItem>
                          <SelectItem value="pcs">PCS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rate_per_unit">Rate per Unit (₹)</Label>
                      <Input id="rate_per_unit" name="rate_per_unit" type="number" step="0.01" defaultValue={editingItem?.rate_per_unit} required />
                    </div>
                    <div className="flex items-center gap-4 pt-8">
                      <Label htmlFor="is_composite">Composite Material</Label>
                      <Switch id="is_composite" name="is_composite" defaultChecked={editingItem?.is_composite} />
                    </div>
                  </div>
                </>
              ) : dialogType === "boms" ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="product_name">Product / Job Name</Label>
                    <Input id="product_name" name="product_name" defaultValue={editingItem?.product_name} placeholder="e.g. Standard 50x100 Chromo Label" required />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-primary font-bold uppercase text-[10px]">Material Requirements</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addBomMaterial}><Plus className="h-3 w-3 mr-1" /> Add Component</Button>
                    </div>
                    
                    {bomMaterials.map((bm, idx) => (
                      <div key={idx} className="p-4 border rounded-lg bg-muted/20 space-y-4 relative">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive h-6 w-6" onClick={() => removeBomMaterial(idx)}><Trash2 className="h-3 w-3" /></Button>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase">Select Raw Material</Label>
                            <Select value={bm.material_id} onValueChange={(val) => updateBomMaterial(idx, 'material_id', val)}>
                              <SelectTrigger><SelectValue placeholder="Choose material" /></SelectTrigger>
                              <SelectContent>
                                {rawMaterials?.map(rm => <SelectItem key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase">Consumption Type</Label>
                            <Select value={bm.consumption_type} onValueChange={(val) => updateBomMaterial(idx, 'consumption_type', val)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="per_1000">Per 1000 Labels</SelectItem>
                                <SelectItem value="per_sqm">Per SQM</SelectItem>
                                <SelectItem value="fixed">Fixed Quantity</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase">Consumption Value</Label>
                            <Input type="number" step="0.001" value={bm.consumption_value} onChange={(e) => updateBomMaterial(idx, 'consumption_value', Number(e.target.value))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase">Wastage %</Label>
                            <Input type="number" value={bm.wastage_percent} onChange={(e) => updateBomMaterial(idx, 'wastage_percent', Number(e.target.value))} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : dialogType === "customers" ? (
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
                      
                      {hasPermission('client_credit_edit') ? (
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-primary/5">
                          <div className="space-y-2">
                            <Label htmlFor="creditDays">Credit Days</Label>
                            <Input id="creditDays" name="creditDays" type="number" defaultValue={editingItem?.creditDays || 0} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="outstandingAmount">Outstanding (₹)</Label>
                            <Input id="outstandingAmount" name="outstandingAmount" type="number" defaultValue={editingItem?.outstandingAmount || 0} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                            <Input id="creditLimit" name="creditLimit" type="number" defaultValue={editingItem?.creditLimit || 0} />
                          </div>
                          <div className="flex flex-col justify-end space-y-2">
                            <Label htmlFor="isCreditBlocked">Block Client</Label>
                            <Switch id="isCreditBlocked" name="isCreditBlocked" defaultChecked={!!editingItem?.isCreditBlocked} />
                          </div>
                        </div>
                      ) : editingItem && (
                        <div className="p-4 border rounded-lg bg-muted/20 space-y-2 text-xs">
                          <p className="font-bold text-primary uppercase">Financial Summary</p>
                          <div className="flex justify-between"><span>Credit:</span> <span>{editingItem.creditDays || 0} Days</span></div>
                          <div className="flex justify-between"><span>Outstanding:</span> <span>₹{editingItem.outstandingAmount?.toLocaleString() || 0}</span></div>
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
              ) : null}
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">{editingItem ? 'Save Changes' : 'Create Record'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="raw_materials" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex overflow-x-auto h-auto">
          <TabsTrigger value="raw_materials" className="gap-2"><FlaskConical className="h-4 w-4" /> Raw Materials</TabsTrigger>
          <TabsTrigger value="boms" className="gap-2"><Layers className="h-4 w-4" /> BOM Master</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2"><Truck className="h-4 w-4" /> Suppliers</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2"><Box className="h-4 w-4" /> Machines</TabsTrigger>
          <TabsTrigger value="cylinders" className="gap-2"><Ruler className="h-4 w-4" /> Cylinders</TabsTrigger>
          <TabsTrigger value="clients" className="gap-2"><Users className="h-4 w-4" /> Clients</TabsTrigger>
        </TabsList>
        
        <TabsContent value="raw_materials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Raw Material Registry</CardTitle>
                <CardDescription>Flexible inventory components for label production.</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("raw_materials")}><Plus className="h-4 w-4 mr-2" /> Add Material</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Rate (₹)</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : rawMaterials?.map((rm) => (
                    <TableRow key={rm.id}>
                      <TableCell className="font-bold">{rm.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="uppercase text-[9px]">{rm.category}</Badge></TableCell>
                      <TableCell className="uppercase text-xs">{rm.unit}</TableCell>
                      <TableCell>₹{rm.rate_per_unit}</TableCell>
                      <TableCell>
                        {rm.is_composite ? <Badge className="bg-blue-500">Composite</Badge> : <Badge variant="outline">Single</Badge>}
                      </TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog("raw_materials", rm)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete("raw_materials", rm.id, rm.name)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boms">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>BOM Master Library</CardTitle>
                <CardDescription>Reusable technical recipes for standardized products.</CardDescription>
              </div>
              <Button onClick={() => openAddDialog("boms")}><Plus className="h-4 w-4 mr-2" /> Create BOM</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bomsLoading ? (
                  <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>
                ) : boms?.map((bom) => (
                  <Card key={bom.id} className="relative group hover:border-primary transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-black uppercase tracking-tight">{bom.product_name}</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase">{bom.materials?.length || 0} COMPONENTS</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        {bom.materials?.slice(0, 3).map((m: any, i: number) => {
                          const mat = rawMaterials?.find(r => r.id === m.material_id);
                          return (
                            <div key={i} className="flex justify-between text-xs text-muted-foreground">
                              <span>{mat?.name || 'Unknown'}</span>
                              <span>{m.consumption_value} {mat?.unit}</span>
                            </div>
                          );
                        })}
                        {(bom.materials?.length || 0) > 3 && (
                          <div className="text-[10px] text-primary font-bold italic">+{bom.materials.length - 3} more...</div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog("boms", bom)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete("boms", bom.id, bom.product_name)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
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

        <TabsContent value="machines">
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

        <TabsContent value="cylinders">
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

        <TabsContent value="clients">
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
                        <Badge className={(c.status === 'Active' || c.isActive !== false) ? (checkIsOverdue(c) ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-muted'}>
                          {(c.status === 'Active' || c.isActive !== false) ? (checkIsOverdue(c) ? 'OVERDUE' : 'ACTIVE') : 'INACTIVE'}
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
      </Tabs>

      {/* View Details Dialog for Customers */}
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
    </div>
  )
}
