
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Search, 
  QrCode, 
  Loader2, 
  Boxes, 
  FilterX, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Briefcase,
  Download,
  Eye,
  LayoutGrid,
  Info,
  AlertCircle
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog"
import { 
  DropdownMenu, 
  DropdownMenuCheckboxItem, 
  DropdownMenuContent, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"

type SortField = 'barcode' | 'itemType' | 'status' | 'receivedDate' | 'sqm';
type SortOrder = 'asc' | 'desc';

export default function InventoryPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>('barcode')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    rollId: true,
    companyRollNo: true,
    paperCompany: true,
    paperType: true,
    width: true,
    gsm: true,
    length: true,
    weight: true,
    lotNo: true,
    receivedDate: true,
    status: true,
    job: true,
    action: true
  })

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries
  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'inventoryItems');
  }, [firestore, user, adminData])

  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jumbo_stock');
  }, [firestore, user, adminData])

  const alertsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'alerts');
  }, [firestore, user, adminData])

  const { data: inventory, isLoading: itemsLoading } = useCollection(inventoryQuery)
  const { data: jumbos, isLoading: jumbosLoading } = useCollection(jumboQuery)
  const { data: alerts } = useCollection(alertsQuery)

  const combinedStock = useMemo(() => {
    const jumboItems = jumbos?.map(j => ({ 
      ...j, 
      id: j.id,
      name: j.paperType, 
      itemType: 'Jumbo Roll', 
      barcode: j.rollNo,
      companyRollNo: j.companyRollNo || j.rollNo,
      widthMm: j.widthMm,
      lengthMeters: j.lengthMeters,
      sqm: j.sqm,
      gsm: j.gsm,
      weightKg: j.weightKg,
      lotNo: j.lotNo,
      receivedDate: j.receivedDate,
      lastUsedDate: j.dateOfUse || "-",
      purchaseRate: j.purchaseRate,
      status: j.status || 'In Stock',
      hasAlert: alerts?.some(a => a.rollId === j.rollNo && !a.resolved)
    })) || [];
    
    const otherItems = inventory?.map(i => ({
      ...i,
      id: i.id,
      companyRollNo: i.parentRollNo || "-",
      receivedDate: i.createdAt ? new Date(i.createdAt).toISOString().split('T')[0] : "-",
      lastUsedDate: i.updatedAt ? new Date(i.updatedAt).toISOString().split('T')[0] : "-",
      hasAlert: alerts?.some(a => a.rollId === i.barcode && !a.resolved)
    })) || [];

    let result = [...jumboItems, ...otherItems];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.barcode || "").toLowerCase().includes(q) ||
        (item.companyRollNo || "").toLowerCase().includes(q) ||
        (item.lotNo || "").toLowerCase().includes(q) ||
        (item.assigned_job_id || "").toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") result = result.filter(item => item.itemType === categoryFilter);
    if (statusFilter !== "all") result = result.filter(item => item.status === statusFilter);

    result.sort((a, b) => {
      let valA = a[sortField]?.toString().toLowerCase() || "";
      let valB = b[sortField]?.toString().toLowerCase() || "";
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [jumbos, inventory, alerts, searchQuery, categoryFilter, statusFilter, sortField, sortOrder]);

  const stats = useMemo(() => {
    const totalSqm = combinedStock.reduce((acc, item) => acc + (Number(item.sqm) || 0), 0)
    const inStock = combinedStock.filter(i => i.status === 'In Stock').length
    const assigned = combinedStock.filter(i => i.status === 'ASSIGNED' || i.status === 'In Production').length
    return { total: combinedStock.length, totalSqm, inStock, assigned }
  }, [combinedStock])

  const handleExport = () => {
    const data = combinedStock.map(item => ({
      "Roll ID": item.barcode,
      "Company Roll No": item.companyRollNo,
      "Paper Company": item.paperCompany || "-",
      "Paper Type": item.itemType,
      "Width (mm)": item.widthMm,
      "GSM": item.gsm,
      "Length (mtr)": item.lengthMeters,
      "Weight (kg)": item.weightKg,
      "Lot No": item.lotNo,
      "Received": item.receivedDate,
      "Status": item.status,
      "Assigned Job": item.assigned_job_id || "-"
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Inventory");
    XLSX.writeFile(wb, `Stock_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Inventory Exported", description: "Standard technical registry saved." });
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  if (!isMounted) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isLoading = itemsLoading || jumbosLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Stock Registry</h2>
          <p className="text-muted-foreground">Full technical traceability and material hierarchy.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export All</Button>
          <Button variant="outline" onClick={() => toast({ title: "Scanner Active", description: "Ready to scan barcode..." })}>
            <QrCode className="mr-2 h-4 w-4" /> Scan Barcode
          </Button>
        </div>
      </div>

      {/* Summary Statistics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Inventory Items</span>
            <span className="text-2xl font-black text-primary">{stats.total}</span>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available SQM</span>
            <span className="text-2xl font-black text-primary">{stats.totalSqm.toLocaleString()}</span>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">In Stock (Jumbos)</span>
            <span className="text-2xl font-black text-emerald-600">{stats.inStock}</span>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assigned to Production</span>
            <span className="text-2xl font-black text-blue-600">{stats.assigned}</span>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Stock Detail: {selectedItem?.barcode}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Material Name</span><span className="font-bold">{selectedItem?.name}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Category</span><Badge variant="secondary">{selectedItem?.itemType}</Badge></div>
            <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Status</span><Badge className={selectedItem?.status === 'ASSIGNED' ? 'bg-blue-500' : 'bg-emerald-500'}>{selectedItem?.status}</Badge></div>
            {selectedItem?.assigned_job_id && (
              <div className="bg-primary/5 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold"><Briefcase className="h-4 w-4" /> Assignment Details</div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <span className="text-muted-foreground">Job ID</span><span className="font-bold">{selectedItem.assigned_job_id}</span>
                  <span className="text-muted-foreground">Job Name</span><span className="font-medium">{selectedItem.assigned_job_name}</span>
                  <span className="text-muted-foreground">Assigned Date</span><span>{new Date(selectedItem.assigned_date).toLocaleDateString()}</span>
                </div>
              </div>
            )}
            <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Dimensions</span><span className="font-mono">{selectedItem?.widthMm}mm x {selectedItem?.lengthMeters}m</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Lot Number</span><span className="font-mono">{selectedItem?.lotNo || '-'}</span></div>
          </div>
          <DialogFooter><Button variant="outline" className="w-full" onClick={() => setIsDetailsOpen(false)}>Close Record</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> Inventory Assignment Registry</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search barcode, job, lot..." className="pl-8 w-[200px] lg:w-[300px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Jumbo Roll">Jumbo Rolls</SelectItem>
                  <SelectItem value="Slitted Roll">Slitted Rolls</SelectItem>
                  <SelectItem value="Finished Good">Finished Goods</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon"><LayoutGrid className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {Object.keys(visibleColumns).map(col => (
                    <DropdownMenuCheckboxItem
                      key={col}
                      checked={visibleColumns[col]}
                      onCheckedChange={val => setVisibleColumns({...visibleColumns, [col]: val})}
                      className="capitalize"
                    >
                      {col.replace(/([A-Z])/g, ' $1')}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="icon" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setStatusFilter("all"); }}><FilterX className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 border-b">
                <TableRow>
                  {visibleColumns.rollId && <TableHead onClick={() => toggleSort('barcode')} className="cursor-pointer">Roll ID <ArrowUpDown className="ml-1 h-3 w-3 inline" /></TableHead>}
                  {visibleColumns.companyRollNo && <TableHead>Company Roll No</TableHead>}
                  {visibleColumns.paperCompany && <TableHead>Supplier</TableHead>}
                  {visibleColumns.paperType && <TableHead>Type</TableHead>}
                  {visibleColumns.width && <TableHead>Width</TableHead>}
                  {visibleColumns.gsm && <TableHead>GSM</TableHead>}
                  {visibleColumns.length && <TableHead>Length</TableHead>}
                  {visibleColumns.weight && <TableHead>Weight</TableHead>}
                  {visibleColumns.lotNo && <TableHead>Lot No</TableHead>}
                  {visibleColumns.receivedDate && <TableHead onClick={() => toggleSort('receivedDate')} className="cursor-pointer">Received <ArrowUpDown className="ml-1 h-3 w-3 inline" /></TableHead>}
                  {visibleColumns.status && <TableHead>Status</TableHead>}
                  {visibleColumns.job && <TableHead>Assigned Job</TableHead>}
                  {visibleColumns.action && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : combinedStock.map((item) => (
                  <TableRow key={item.id} className={cn("group transition-colors", item.hasAlert && "bg-destructive/10 hover:bg-destructive/20")}>
                    {visibleColumns.rollId && (
                      <TableCell className="font-mono text-xs font-bold text-primary flex items-center gap-2">
                        {item.hasAlert && <AlertCircle className="h-3 w-3 text-destructive" />}
                        {item.barcode}
                      </TableCell>
                    )}
                    {visibleColumns.companyRollNo && <TableCell className="text-[10px] font-mono text-muted-foreground">{item.companyRollNo}</TableCell>}
                    {visibleColumns.paperCompany && <TableCell className="text-xs">{item.paperCompany || "-"}</TableCell>}
                    {visibleColumns.paperType && <TableCell><Badge variant="outline" className="text-[9px] h-5">{item.itemType}</Badge></TableCell>}
                    {visibleColumns.width && <TableCell className="text-xs">{item.widthMm}mm</TableCell>}
                    {visibleColumns.gsm && <TableCell className="text-xs">{item.gsm}</TableCell>}
                    {visibleColumns.length && <TableCell className="text-xs">{item.lengthMeters}m</TableCell>}
                    {visibleColumns.weight && <TableCell className="text-xs">{item.weightKg}kg</TableCell>}
                    {visibleColumns.lotNo && <TableCell className="text-[10px] font-mono">{item.lotNo || "-"}</TableCell>}
                    {visibleColumns.receivedDate && <TableCell className="text-[10px]">{item.receivedDate}</TableCell>}
                    {visibleColumns.status && <TableCell><Badge className={item.status === 'In Stock' ? 'bg-emerald-500' : 'bg-blue-500'}>{item.status}</Badge></TableCell>}
                    {visibleColumns.job && <TableCell>
                      {item.assigned_job_id ? <div className="flex flex-col"><span className="text-[10px] font-bold text-primary">{item.assigned_job_id}</span><span className="text-[9px] text-muted-foreground line-clamp-1">{item.assigned_job_name}</span></div> : "-"}
                    </TableCell>}
                    {visibleColumns.action && <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => {setSelectedItem(item); setIsDetailsOpen(true)}}><Eye className="h-3 w-3" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
