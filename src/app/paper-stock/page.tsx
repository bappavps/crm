
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Search, 
  Plus, 
  Loader2, 
  FilterX, 
  Pencil,
  Trash2,
  AlertTriangle,
  Package,
  CheckCircle2,
  RefreshCw,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFirestore, useUser, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  limit, 
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore"
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/components/auth/permission-context"
import { ActionModal, ModalType } from "@/components/action-modal"

export default function PaperStockPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  const [defaultDate, setDefaultDate] = useState("")
  
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    onConfirm?: () => void;
    autoClose?: boolean;
  }>({
    isOpen: false,
    type: 'SUCCESS',
    title: '',
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoll, setEditingRoll] = useState<any>(null)
  
  // High-density form state for all 19 columns
  const [formData, setFormData] = useState({
    rollNo: "",
    receivedDate: "",
    jobNo: "",
    paperCompany: "",
    paperType: "",
    gsm: 0,
    size: "",
    widthMm: 0,
    lengthMeters: 0,
    quantity: 1,
    sqm: 0,
    lotNo: "",
    productName: "",
    code: "",
    status: "Available",
    location: "",
    supplier: "",
    createdByName: "",
    remarks: ""
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({ search: "" })

  useEffect(() => { 
    setIsMounted(true)
    const today = new Date().toISOString().split('T')[0]
    setDefaultDate(today)
  }, [])

  // Auto-calculation logic for SQM
  useEffect(() => {
    const w = Number(formData.widthMm) || 0
    const l = Number(formData.lengthMeters) || 0
    const q = Number(formData.quantity) || 0
    const calculatedSqm = Number(((w / 1000) * l * q).toFixed(2))
    setFormData(prev => ({ ...prev, sqm: calculatedSqm }))
  }, [formData.widthMm, formData.lengthMeters, formData.quantity])

  const showModal = (type: ModalType, title: string, description?: string, onConfirm?: () => void, autoClose = false) => {
    setModal({ isOpen: true, type, title, description, onConfirm, autoClose });
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (!firestore || !isMounted) return;
    setIsLoading(true);

    const q = query(collection(firestore, 'paper_stock'), limit(500));
    const unsubscribe = onSnapshot(q, (snap) => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (filters.search) {
        const s = filters.search.toLowerCase();
        docs = docs.filter(d => 
          (d.rollNo || "").toLowerCase().includes(s) || 
          (d.lotNo || "").toLowerCase().includes(s) ||
          (d.paperCompany || "").toLowerCase().includes(s)
        );
      }
      setRows(docs);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, isMounted, filters.search]);

  const handleOpenDialog = (roll?: any) => {
    if (roll) {
      setEditingRoll(roll)
      setFormData({
        rollNo: roll.rollNo || "",
        receivedDate: roll.receivedDate || defaultDate,
        jobNo: roll.jobNo || "",
        paperCompany: roll.paperCompany || "",
        paperType: roll.paperType || "",
        gsm: Number(roll.gsm) || 0,
        size: roll.size || "",
        widthMm: Number(roll.widthMm) || 0,
        lengthMeters: Number(roll.lengthMeters) || 0,
        quantity: Number(roll.quantity) || 1,
        sqm: Number(roll.sqm) || 0,
        lotNo: roll.lotNo || "",
        productName: roll.productName || "",
        code: roll.code || "",
        status: roll.status || "Available",
        location: roll.location || "",
        supplier: roll.supplier || "",
        createdByName: roll.createdByName || user?.displayName || "System",
        remarks: roll.remarks || ""
      })
    } else {
      setEditingRoll(null)
      setFormData({
        rollNo: "",
        receivedDate: defaultDate,
        jobNo: "",
        paperCompany: "",
        paperType: "",
        gsm: 0,
        size: "",
        widthMm: 0,
        lengthMeters: 0,
        quantity: 1,
        sqm: 0,
        lotNo: "",
        productName: "",
        code: "",
        status: "Available",
        location: "",
        supplier: "",
        createdByName: user?.displayName || "System",
        remarks: ""
      })
    }
    setIsDialogOpen(true)
  }

  const handleDeleteRoll = (roll: any) => {
    showModal('CONFIRMATION', 'Delete Roll?', `Remove ${roll.rollNo} from registry permanently?`, () => {
      setIsProcessing(true);
      deleteDocumentNonBlocking(doc(firestore!, 'paper_stock', roll.id));
      closeModal();
      showModal('SUCCESS', 'Roll Deleted Successfully', undefined, undefined, true);
      setIsProcessing(false);
    });
  }

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user) return;

    if (!formData.rollNo || !formData.paperCompany || !formData.gsm || !formData.widthMm) {
      showModal('WARNING', 'Missing Data', 'Please fill all mandatory technical fields.');
      return;
    }

    setIsProcessing(true);
    const docRef = doc(firestore, 'paper_stock', formData.rollNo);
    
    const payload = {
      ...formData,
      gsm: Number(formData.gsm),
      widthMm: Number(formData.widthMm),
      lengthMeters: Number(formData.lengthMeters),
      quantity: Number(formData.quantity),
      sqm: Number(formData.sqm),
      updatedAt: serverTimestamp(),
      ...(editingRoll ? {} : { createdAt: serverTimestamp(), createdById: user.uid })
    };

    if (editingRoll) {
      updateDocumentNonBlocking(docRef, payload);
    } else {
      setDocumentNonBlocking(docRef, payload, { merge: true });
    }

    setIsDialogOpen(false);
    showModal('SUCCESS', editingRoll ? 'Roll Updated Successfully' : 'Roll Added Successfully', undefined, undefined, true);
    setIsProcessing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'reserved': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'used': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 font-sans">
      <ActionModal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        description={modal.description}
        onConfirm={modal.onConfirm}
        isProcessing={isProcessing}
        autoClose={modal.autoClose}
      />

      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-lg border shadow-sm">
        <div className="relative min-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search Roll ID, Company, Lot..." 
            className="pl-8 h-9 text-xs" 
            value={filters.search} 
            onChange={e => setFilters({ search: e.target.value })} 
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "" })} className="h-9 px-2 text-xs">
          <FilterX className="h-4 w-4 mr-1" /> Clear
        </Button>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-xl rounded-xl bg-white">
        <div className="bg-[#4db6ac] text-white p-3 flex items-center justify-between shrink-0 px-6">
          <h2 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <Package className="h-4 w-4" /> Paper Stock Registry
          </h2>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setFilters({ search: "" })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto relative">
          <Table className="border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-30 bg-slate-50 border-b shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center font-bold text-[11px] uppercase border-r sticky left-0 bg-slate-50 z-40">Sr</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-center">Received</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Roll ID</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Job No</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Company</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Type</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-right">GSM</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Size</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-right">Width</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-right">Length</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-right text-teal-700">SQM</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-center">Qty</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Lot No</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Status</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Location</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Supplier</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r">Created By</TableHead>
                <TableHead className="text-right font-bold text-[11px] uppercase sticky right-0 bg-slate-50 z-40 border-l">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={18} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-teal-500 h-8 w-8" /></TableCell></TableRow>
              ) : rows.map((j, i) => (
                <TableRow key={j.id} className="hover:bg-slate-50 transition-colors border-b h-10 group">
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-0 bg-white z-20">{i+1}</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap">{j.receivedDate}</TableCell>
                  <TableCell className="font-bold text-[11px] text-teal-700 border-r">{j.rollNo}</TableCell>
                  <TableCell className="text-[11px] border-r text-blue-600">{j.jobNo || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r whitespace-nowrap">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.paperType}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.size || "-"}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.widthMm}mm</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.lengthMeters}m</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-bold text-teal-600 font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-center text-[11px] border-r">{j.quantity}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium">{j.lotNo}</TableCell>
                  <TableCell className="text-center border-r">
                    <Badge variant="outline" className={cn("text-[9px] font-bold h-5 uppercase px-2 border", getStatusColor(j.status))}>
                      {j.status || "Available"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] border-r">{j.location || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.supplier || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r text-slate-400 italic">{j.createdByName || "Admin"}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white" onClick={() => handleOpenDialog(j)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {hasPermission('admin') && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteRoll(j)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 19-FIELD FORM DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-[#4db6ac] text-white">
              <DialogTitle className="uppercase font-black text-xl tracking-tight flex items-center gap-2">
                {editingRoll ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingRoll ? 'Edit Substrate Record' : 'Add New Substrate'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white">
              {/* Row 1 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Roll ID (Primary Key)</Label>
                <Input 
                  value={formData.rollNo} 
                  onChange={e => setFormData({ ...formData, rollNo: e.target.value })}
                  placeholder="e.g. R-1001"
                  required 
                  readOnly={!!editingRoll}
                  className="h-10 font-black uppercase bg-slate-50 border-slate-200" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Date Received</Label>
                <Input 
                  type="date" 
                  value={formData.receivedDate} 
                  onChange={e => setFormData({ ...formData, receivedDate: e.target.value })}
                  className="h-10 font-bold" 
                />
              </div>

              {/* Row 2 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Paper Company</Label>
                <Select value={formData.paperCompany} onValueChange={v => setFormData({ ...formData, paperCompany: v })}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Avery Dennison">Avery Dennison</SelectItem>
                    <SelectItem value="SMI">SMI</SelectItem>
                    <SelectItem value="UPM Raflatac">UPM Raflatac</SelectItem>
                    <SelectItem value="Local Vendor">Local Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Paper Type</Label>
                <Select value={formData.paperType} onValueChange={v => setFormData({ ...formData, paperType: v })}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHROMO">CHROMO</SelectItem>
                    <SelectItem value="PE WHITE">PE WHITE</SelectItem>
                    <SelectItem value="PE CLEAR">PE CLEAR</SelectItem>
                    <SelectItem value="PP SILVER">PP SILVER</SelectItem>
                    <SelectItem value="DIRECT THERMAL">DIRECT THERMAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 3 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">GSM</Label>
                <Input 
                  type="number" 
                  value={formData.gsm} 
                  onChange={e => setFormData({ ...formData, gsm: Number(e.target.value) })}
                  placeholder="80" 
                  required 
                  className="h-10 font-bold" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Size (Dimensions)</Label>
                <Input 
                  value={formData.size} 
                  onChange={e => setFormData({ ...formData, size: e.target.value })}
                  placeholder="e.g. 1020mm" 
                  className="h-10 font-bold" 
                />
              </div>

              {/* Row 4 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">Width (mm)</Label>
                <Input 
                  type="number" 
                  value={formData.widthMm} 
                  onChange={e => setFormData({ ...formData, widthMm: Number(e.target.value) })}
                  required 
                  className="h-10 font-black border-teal-100" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">Length (Meters)</Label>
                <Input 
                  type="number" 
                  value={formData.lengthMeters} 
                  onChange={e => setFormData({ ...formData, lengthMeters: Number(e.target.value) })}
                  required 
                  className="h-10 font-black border-teal-100" 
                />
              </div>

              {/* Row 5 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">Quantity (Rolls)</Label>
                <Input 
                  type="number" 
                  value={formData.quantity} 
                  onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  required 
                  className="h-10 font-black border-teal-100" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-primary">SQM (Auto-Calculated)</Label>
                <Input 
                  value={formData.sqm} 
                  readOnly 
                  className="h-10 font-black bg-primary/5 text-primary border-primary/20" 
                />
              </div>

              {/* Row 6 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Lot Number</Label>
                <Input 
                  value={formData.lotNo} 
                  onChange={e => setFormData({ ...formData, lotNo: e.target.value })}
                  placeholder="LOT-XYZ-123" 
                  className="h-10 font-bold" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Product Name</Label>
                <Input 
                  value={formData.productName} 
                  onChange={e => setFormData({ ...formData, productName: e.target.value })}
                  placeholder="Fasson Chromo" 
                  className="h-10 font-bold" 
                />
              </div>

              {/* Row 7 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Internal Code</Label>
                <Input 
                  value={formData.code} 
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  placeholder="AW0331" 
                  className="h-10 font-mono text-xs font-bold" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-10 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Reserved">Reserved</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Consumed">Consumed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 8 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Job No Ref</Label>
                <Input 
                  value={formData.jobNo} 
                  onChange={e => setFormData({ ...formData, jobNo: e.target.value })}
                  placeholder="JOB-2026-..." 
                  className="h-10 font-bold text-blue-600" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Stock Location</Label>
                <Input 
                  value={formData.location} 
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Section A-1" 
                  className="h-10 font-bold" 
                />
              </div>

              {/* Row 9 */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Created By</Label>
                <Input 
                  value={formData.createdByName} 
                  readOnly 
                  className="h-10 font-bold bg-slate-50 text-slate-400 italic" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Supplier Name</Label>
                <Input 
                  value={formData.supplier} 
                  onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Vendor Name" 
                  className="h-10 font-bold" 
                />
              </div>

              {/* Full Width Remarks */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Remarks / Quality Notes</Label>
                <Textarea 
                  value={formData.remarks} 
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Any technical deviations or special instructions..."
                  className="min-h-[80px] font-medium" 
                />
              </div>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t">
              <Button type="submit" disabled={isProcessing} className="w-full h-14 uppercase font-black tracking-widest text-lg shadow-xl bg-[#4db6ac] hover:bg-[#3d9e94]">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                {editingRoll ? 'Update Substrate' : 'Initialize Stock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
