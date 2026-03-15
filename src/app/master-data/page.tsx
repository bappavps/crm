
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Pencil, Loader2, Info, Factory, Wrench, Users, ShoppingBag, Layers, Box } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase"
import { collection, doc, serverTimestamp, deleteDoc } from "firebase/firestore"
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { ActionModal, ModalType } from "@/components/action-modal"
import { usePermissions } from "@/components/auth/permission-context"
import { cn } from "@/lib/utils"

export default function MasterDataPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { hasPermission } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<string>("raw_materials")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Machine specific form state
  const [machineData, setMachineData] = useState({
    machine_type: "Slitting",
    section: "Jumbo",
    status: "Active"
  })

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    onConfirm?: () => void;
    autoClose?: boolean;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  useEffect(() => { setIsMounted(true) }, []);

  // Sync machine form state when editing
  useEffect(() => {
    if (editingItem && dialogType === 'machines') {
      setMachineData({
        machine_type: editingItem.machine_type || "Slitting",
        section: editingItem.section || "Jumbo",
        status: editingItem.status || "Active"
      });
    } else {
      setMachineData({
        machine_type: "Slitting",
        section: "Jumbo",
        status: "Active"
      });
    }
  }, [editingItem, dialogType, isDialogOpen]);

  const rawMaterialsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'raw_materials') : null, [firestore]);
  const suppliersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'suppliers') : null, [firestore]);
  const machinesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'machines') : null, [firestore]);
  const cylindersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'cylinders') : null, [firestore]);
  const customersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'customers') : null, [firestore]);
  const bomsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'boms') : null, [firestore]);

  const { data: rawMaterials, isLoading: loadingRaw } = useCollection(rawMaterialsQuery);
  const { data: suppliers, isLoading: loadingSuppliers } = useCollection(suppliersQuery);
  const { data: machines, isLoading: loadingMachines } = useCollection(machinesQuery);
  const { data: cylinders, isLoading: loadingCylinders } = useCollection(cylindersQuery);
  const { data: customers, isLoading: loadingCustomers } = useCollection(customersQuery);
  const { data: boms, isLoading: loadingBoms } = useCollection(bomsQuery);

  const showModal = (type: ModalType, title: string, description?: string, onConfirm?: () => void, autoClose = false) => {
    setModal({ isOpen: true, type, title, description, onConfirm, autoClose });
  };

  const handleSingleDelete = (item: any, type: string) => {
    showModal('CONFIRMATION', 'Delete Record?', `Permanently remove "${item.name || item.machine_name || item.companyName}" from the registry?`, async () => {
      setIsProcessing(true);
      try {
        await deleteDoc(doc(firestore!, type, item.id));
        setModal(p => ({...p, isOpen: false}));
        showModal('SUCCESS', 'Record Deleted', undefined, undefined, true);
      } catch (err: any) {
        showModal('ERROR', 'Deletion Failed', err.message);
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    
    // Type conversions
    if (data.rate_per_unit) data.rate_per_unit = Number(data.rate_per_unit);
    
    // Inject specialized machine fields if applicable
    if (dialogType === 'machines') {
      data.machine_type = machineData.machine_type;
      data.section = machineData.section;
      data.status = machineData.status;
    }

    try {
      if (editingItem) {
        updateDocumentNonBlocking(doc(firestore!, dialogType, editingItem.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } else {
        addDocumentNonBlocking(collection(firestore!, dialogType), { 
          ...data, 
          createdAt: serverTimestamp() 
        });
      }
      
      setIsDialogOpen(false);
      showModal('SUCCESS', 'Master Data Saved', undefined, undefined, true);
    } catch (err: any) {
      showModal('ERROR', 'Save Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderDialogFields = () => {
    if (dialogType === 'machines') {
      return (
        <>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black">Machine Name</Label>
            <Input name="machine_name" defaultValue={editingItem?.machine_name} placeholder="e.g. Jumbo Slitter 1" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black">Machine Type</Label>
              <Select value={machineData.machine_type} onValueChange={(val) => setMachineData({...machineData, machine_type: val})}>
                <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Slitting">Slitting</SelectItem>
                  <SelectItem value="Printing">Printing</SelectItem>
                  <SelectItem value="Die Cutting">Die Cutting</SelectItem>
                  <SelectItem value="Finishing">Finishing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black">Status</Label>
              <Select value={machineData.status} onValueChange={(val) => setMachineData({...machineData, status: val})}>
                <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black">Production Section</Label>
            <Select value={machineData.section} onValueChange={(val) => setMachineData({...machineData, section: val})}>
              <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Jumbo">Jumbo</SelectItem>
                <SelectItem value="POS Roll">POS Roll</SelectItem>
                <SelectItem value="One Ply">One Ply</SelectItem>
                <SelectItem value="Printing">Printing</SelectItem>
                <SelectItem value="Flat Bed">Flat Bed</SelectItem>
                <SelectItem value="Rotery Die">Rotery Die</SelectItem>
                <SelectItem value="Label Slitting">Label Slitting</SelectItem>
                <SelectItem value="Packing">Packing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }

    if (dialogType === 'customers') {
      return (
        <>
          <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Company Name</Label><Input name="companyName" defaultValue={editingItem?.companyName} required /></div>
          <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Contact Person</Label><Input name="contactPerson" defaultValue={editingItem?.contactPerson} /></div>
          <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Email Address</Label><Input name="email" type="email" defaultValue={editingItem?.email} /></div>
        </>
      );
    }
    
    return (
      <>
        <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Name / Title</Label><Input name="name" defaultValue={editingItem?.name} required /></div>
        <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Specs / Unit</Label><Input name="unit" defaultValue={editingItem?.unit} /></div>
        <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Value / Rate</Label><Input name="rate_per_unit" type="number" step="0.001" defaultValue={editingItem?.rate_per_unit} /></div>
      </>
    );
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6 font-sans">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({...p, isOpen: false}))} {...modal} isProcessing={isProcessing} />
      
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Master Control Panel</h2>
          <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Enterprise Technical Constants & Registry</p>
        </div>
      </div>

      <Tabs defaultValue="raw_materials" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex overflow-x-auto h-auto whitespace-nowrap rounded-xl border">
          <TabsTrigger value="raw_materials" className="gap-2 font-bold px-6 h-10"><Box className="h-4 w-4" /> Raw Materials</TabsTrigger>
          <TabsTrigger value="boms" className="gap-2 font-bold px-6 h-10"><Layers className="h-4 w-4" /> BOM Master</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2 font-bold px-6 h-10"><ShoppingBag className="h-4 w-4" /> Suppliers</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2 font-bold px-6 h-10"><Wrench className="h-4 w-4" /> Machines</TabsTrigger>
          <TabsTrigger value="cylinders" className="gap-2 font-bold px-6 h-10"><Factory className="h-4 w-4" /> Cylinders</TabsTrigger>
          <TabsTrigger value="customers" className="gap-2 font-bold px-6 h-10"><Users className="h-4 w-4" /> Clients</TabsTrigger>
        </TabsList>
        
        {/* CATEGORY: MACHINES */}
        <TabsContent value="machines">
          <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-6">
              <div className="space-y-1">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" /> Machine Registry
                </CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Register production floor assets for scheduling</p>
              </div>
              <Button size="sm" className="bg-primary hover:bg-primary/90 font-black uppercase text-[10px] tracking-widest" onClick={() => { setDialogType("machines"); setEditingItem(null); setIsDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Machine
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-black text-[10px] uppercase pl-8 py-4">Machine Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase py-4">Type</TableHead>
                    <TableHead className="font-black text-[10px] uppercase py-4">Section</TableHead>
                    <TableHead className="font-black text-[10px] uppercase py-4">Status</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase pr-8 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMachines ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></TableCell></TableRow>
                  ) : machines?.map((m) => (
                    <TableRow key={m.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-black pl-8">{m.machine_name}</TableCell>
                      <TableCell><Badge variant="outline" className="font-bold text-[10px]">{m.machine_type}</Badge></TableCell>
                      <TableCell className="text-xs font-bold uppercase text-slate-500">{m.section}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px] font-black", m.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400')}>
                          {m.status?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-100 hover:bg-primary/10 hover:text-primary rounded-lg" onClick={() => { setEditingItem(m); setDialogType("machines"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-100 hover:bg-destructive/10 hover:text-destructive rounded-lg" onClick={() => handleSingleDelete(m, "machines")}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {machines?.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic uppercase text-[10px] font-bold tracking-widest">No machines registered</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OTHER TABS (Simplified for brevity but functional) */}
        {['raw_materials', 'boms', 'suppliers', 'cylinders', 'customers'].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest">{tab.replace('_', ' ')} Master</CardTitle>
                <Button size="sm" className="bg-primary hover:bg-primary/90 font-black uppercase text-[10px] tracking-widest" onClick={() => { setDialogType(tab); setEditingItem(null); setIsDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Add Record
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase pl-8">Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Unit/Contact</TableHead>
                      <TableHead className="font-black text-[10px] uppercase">Value/Rate</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase pr-8">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tab === 'raw_materials' ? rawMaterials : tab === 'boms' ? boms : tab === 'suppliers' ? suppliers : tab === 'cylinders' ? cylinders : customers)?.map((item: any) => (
                      <TableRow key={item.id} className="hover:bg-slate-50">
                        <TableCell className="font-bold pl-8">{item.name || item.companyName}</TableCell>
                        <TableCell className="text-xs">{item.unit || item.contactPerson || "-"}</TableCell>
                        <TableCell className="font-black text-primary">
                          {item.rate_per_unit ? `₹${item.rate_per_unit}` : item.email || "-"}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-100 rounded-lg" onClick={() => { setEditingItem(item); setDialogType(tab); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-100 text-destructive rounded-lg" onClick={() => handleSingleDelete(item, tab)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* DYNAMIC MASTER DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl">
          <form onSubmit={handleSave}>
            <div className="bg-slate-900 text-white p-6">
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                {editingItem ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                {editingItem ? 'Edit' : 'Create'} {dialogType.replace('_', ' ').slice(0, -1)} Record
              </DialogTitle>
            </div>
            <div className="p-8 space-y-6 bg-slate-50">
              {renderDialogFields()}
            </div>
            <DialogFooter className="p-6 bg-white border-t">
              <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest border-2" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isProcessing} className="h-12 px-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Save Master Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
