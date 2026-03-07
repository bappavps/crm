
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Loader2, 
  Info,
  Package
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog"
import { useCollection, useFirestore, useUser } from "@/firebase"
import { collection, doc, serverTimestamp, deleteDoc } from "firebase/firestore"
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/components/auth/permission-context"

export default function MasterDataPage() {
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<string>("raw_materials")
  const [editingItem, setEditingItem] = useState<any>(null)

  // Firestore Queries
  const { data: rawMaterials } = useCollection(firestore ? collection(firestore, 'raw_materials') : null);
  const { data: suppliers } = useCollection(firestore ? collection(firestore, 'suppliers') : null);
  const { data: machines } = useCollection(firestore ? collection(firestore, 'machines') : null);
  const { data: cylinders } = useCollection(firestore ? collection(firestore, 'cylinders') : null);
  const { data: customers } = useCollection(firestore ? collection(firestore, 'customers') : null);
  const { data: boms } = useCollection(firestore ? collection(firestore, 'boms') : null);

  useEffect(() => { setIsMounted(true) }, []);

  const isAdmin = hasPermission('admin');

  const handleSingleDelete = async (item: any, type: string) => {
    if (!firestore || !isAdmin) return;
    if (confirm(`Permanently delete this record?`)) {
      await deleteDoc(doc(firestore, type, item.id));
    }
  };

  const handleOpenEdit = (item: any, type: string) => {
    setEditingItem(item);
    setDialogType(type);
    setIsDialogOpen(true);
  }

  if (!isMounted) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Master Control Panel</h2>
          <p className="text-muted-foreground font-medium">Enterprise technical constants and global directory.</p>
        </div>
      </div>

      <Tabs defaultValue="raw_materials" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex overflow-x-auto h-auto whitespace-nowrap rounded-xl">
          <TabsTrigger value="raw_materials" className="gap-2 font-bold px-6">Raw Materials</TabsTrigger>
          <TabsTrigger value="boms" className="gap-2 font-bold px-6">BOM Master</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2 font-bold px-6">Suppliers</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2 font-bold px-6">Machines</TabsTrigger>
          <TabsTrigger value="cylinders" className="gap-2 font-bold px-6">Cylinders</TabsTrigger>
          <TabsTrigger value="customers" className="gap-2 font-bold px-6">Clients</TabsTrigger>
        </TabsList>
        
        <TabsContent value="raw_materials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-sm font-black uppercase">Raw Material Catalog</CardTitle></div>
              <Button size="sm" onClick={() => { setDialogType("raw_materials"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Unit</TableHead><TableHead>Rate (₹)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rawMaterials?.map((m) => (
                    <TableRow key={m.id} className="text-xs">
                      <TableCell className="font-bold">{m.name}</TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell className="font-bold">₹{m.rate_per_unit}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(m, "raw_materials")}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(m, "raw_materials")}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-sm font-black uppercase">Vendor Directory</CardTitle></div>
              <Button size="sm" onClick={() => { setDialogType("suppliers"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Supplier Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers?.map((s) => (
                    <TableRow key={s.id} className="text-xs">
                      <TableCell className="font-bold">{s.name}</TableCell>
                      <TableCell>{s.unit || 'Substrates'}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(s, "suppliers")}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(s, "suppliers")}><Trash2 className="h-4 w-4" /></Button>
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
              <div><CardTitle className="text-sm font-black uppercase">Production Lines</CardTitle></div>
              <Button size="sm" onClick={() => { setDialogType("machines"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Machine Name</TableHead><TableHead>Max Width</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {machines?.map((m) => (
                    <TableRow key={m.id} className="text-xs">
                      <TableCell className="font-bold">{m.name}</TableCell>
                      <TableCell>{m.unit || '250mm'}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(m, "machines")}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(m, "machines")}><Trash2 className="h-4 w-4" /></Button>
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
              <div><CardTitle className="text-sm font-black uppercase">Cylinder Library</CardTitle></div>
              <Button size="sm" onClick={() => { setDialogType("cylinders"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Tool ID</TableHead><TableHead>Repeat Length</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {cylinders?.map((c) => (
                    <TableRow key={c.id} className="text-xs">
                      <TableCell className="font-bold">{c.name}</TableCell>
                      <TableCell>{c.unit || '508mm'}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c, "cylinders")}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(c, "cylinders")}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-sm font-black uppercase">Client Registry</CardTitle></div>
              <Button size="sm" onClick={() => { setDialogType("customers"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Company Name</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {customers?.map((c) => (
                    <TableRow key={c.id} className="text-xs">
                      <TableCell className="font-bold">{c.name || c.companyName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{c.status || 'Active'}</Badge></TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c, "customers")}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(c, "customers")}><Trash2 className="h-4 w-4" /></Button>
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
              <div><CardTitle className="text-sm font-black uppercase">BOM Master Templates</CardTitle></div>
              <Button size="sm" onClick={() => { setDialogType("boms"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Template Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {boms?.map((b) => (
                    <TableRow key={b.id} className="text-xs">
                      <TableCell className="font-bold">{b.name || b.bomNumber}</TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-[200px]">{b.unit || b.description}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(b, "boms")}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(b, "boms")}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data: any = Object.fromEntries(formData.entries());
            if (data.rate_per_unit) data.rate_per_unit = Number(data.rate_per_unit);
            if (editingItem) updateDocumentNonBlocking(doc(firestore!, dialogType, editingItem.id), data);
            else addDocumentNonBlocking(collection(firestore!, dialogType), { ...data, createdAt: serverTimestamp() });
            setIsDialogOpen(false);
          }}>
            <DialogHeader><DialogTitle className="flex items-center gap-2 uppercase font-black"><Info className="h-5 w-5 text-primary" />{editingItem ? 'Edit' : 'Create'} {dialogType.replace('_', ' ')}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Name / Title</Label><Input name="name" defaultValue={editingItem?.name || editingItem?.companyName} required /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Specs / Unit</Label><Input name="unit" defaultValue={editingItem?.unit || editingItem?.description} /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Value / Rate</Label><Input name="rate_per_unit" type="number" defaultValue={editingItem?.rate_per_unit} /></div>
            </div>
            <DialogFooter><Button type="submit" className="w-full h-12 uppercase font-black">Save Master Record</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
