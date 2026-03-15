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
import { collection, doc, query, limit, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"
import { ColumnHeaderFilter } from "@/components/inventory/column-header-filter"

type SortField = 'barcode' | 'itemType' | 'status' | 'receivedDate' | 'sqm';
type SortOrder = 'asc' | 'desc';

export default function InventoryPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>('barcode')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // Header Filters State
  const [headerFilters, setHeaderFilters] = useState<Record<string, string[]>>({})

  useEffect(() => {
    setIsMounted(true)
  }, [])

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

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries - STRICTLY LIMITED to prevent Quota Exceeded
  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return query(collection(firestore, 'inventoryItems'), limit(100));
  }, [firestore, user, adminData])

  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return query(collection(firestore, 'paper_stock'), orderBy('rollNo', 'desc'), limit(100));
  }, [firestore, user, adminData])

  const alertsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return query(collection(firestore, 'alerts'), limit(50));
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

    // Global Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.barcode || "").toLowerCase().includes(q) ||
        (item.companyRollNo || "").toLowerCase().includes(q) ||
        (item.lotNo || "").toLowerCase().includes(q) ||
        (item.assigned_job_id || "").toLowerCase().includes(q)
      );
    }

    // Top Level Filters
    if (categoryFilter !== "all") result = result.filter(item => item.itemType === categoryFilter);
    if (statusFilter !== "all") result = result.filter(item => item.status === statusFilter);

    // Header Filters
    for (const [key, selected] of Object.entries(headerFilters)) {
      if (selected && selected.length > 0) {
        const val = String(result.find(r => r.id === r.id)?.[key] || ""); // Mapping logic needs to handle field keys
        // Since combinedStock keys might differ from DB keys, we check specifically
        result = result.filter(item => {
          const itemVal = String(item[key] || "");
          return selected.includes(itemVal);
        });
      }
    }

    result.sort((a, b) => {
      let valA = a[sortField]?.toString().toLowerCase() || "";
      let valB = b[sortField]?.toString().toLowerCase() || "";
      if (sortField === 'sqm') {
        valA = Number(a[sortField] || 0);
        valB = Number(b[sortField] || 0);
        return sortOrder === 'asc' ? (valA as any) - (valB as any) : (valB as any) - (valA as any);
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [jumbos, inventory, alerts, searchQuery, categoryFilter, statusFilter, sortField, sortOrder, headerFilters]);

  const stats = useMemo(() => {
    const totalSqm = combinedStock.reduce((acc, item) => acc + (Number(item.sqm) || 0), 0)
    const inStock = combinedStock.filter(i => i.status === 'In Stock' || i.status === 'Available').length
    const assigned = combinedStock.filter(i => i.status === 'ASSIGNED' || i.status === 'In Production').length
    return { total: combinedStock.length, totalSqm, inStock, assigned }
  }, [combinedStock])

  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Inventory Hub</h2>
          <p className="text-muted-foreground">Limited real-time technical registry.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5"><CardContent className="p-4 flex flex-col"><span className="text-[10px] font-bold uppercase">Items</span><span className="text-2xl font-black text-primary">{stats.total}</span></CardContent></Card>
        <Card className="bg-primary/5"><CardContent className="p-4 flex flex-col"><span className="text-[10px] font-bold uppercase">SQM</span><span className="text-2xl font-black text-primary">{stats.totalSqm.toLocaleString()}</span></CardContent></Card>
        <Card className="bg-primary/5"><CardContent className="p-4 flex flex-col"><span className="text-[10px] font-bold uppercase">In Stock</span><span className="text-2xl font-black text-emerald-600">{stats.inStock}</span></CardContent></Card>
        <Card className="bg-primary/5"><CardContent className="p-4 flex flex-col"><span className="text-[10px] font-bold uppercase">Production</span><span className="text-2xl font-black text-blue-600">{stats.assigned}</span></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> Stock Preview</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Filter loaded items..." className="pl-8 w-[200px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Button variant="outline" size="icon" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setStatusFilter("all"); setHeaderFilters({}); }}><FilterX className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="h-10 px-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase text-slate-700">Roll ID</span>
                      <ColumnHeaderFilter 
                        columnKey="barcode" 
                        label="Roll ID" 
                        data={combinedStock} 
                        selectedValues={headerFilters['barcode'] || []} 
                        onFilterChange={(v) => setHeaderFilters(p => ({ ...p, barcode: v }))} 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="h-10 px-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase text-slate-700">Supplier</span>
                      <ColumnHeaderFilter 
                        columnKey="paperCompany" 
                        label="Supplier" 
                        data={combinedStock} 
                        selectedValues={headerFilters['paperCompany'] || []} 
                        onFilterChange={(v) => setHeaderFilters(p => ({ ...p, paperCompany: v }))} 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="h-10 px-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase text-slate-700">Type</span>
                      <ColumnHeaderFilter 
                        columnKey="itemType" 
                        label="Type" 
                        data={combinedStock} 
                        selectedValues={headerFilters['itemType'] || []} 
                        onFilterChange={(v) => setHeaderFilters(p => ({ ...p, itemType: v }))} 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="h-10 px-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase text-slate-700">SQM</span>
                      <ColumnHeaderFilter 
                        columnKey="sqm" 
                        label="SQM" 
                        data={combinedStock} 
                        selectedValues={headerFilters['sqm'] || []} 
                        onFilterChange={(v) => setHeaderFilters(p => ({ ...p, sqm: v }))} 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="h-10 px-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase text-slate-700">Status</span>
                      <ColumnHeaderFilter 
                        columnKey="status" 
                        label="Status" 
                        data={combinedStock} 
                        selectedValues={headerFilters['status'] || []} 
                        onFilterChange={(v) => setHeaderFilters(p => ({ ...p, status: v }))} 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="text-right h-10 px-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsLoading || jumbosLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : combinedStock.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-bold text-primary">{item.barcode}</TableCell>
                    <TableCell className="text-xs">{item.paperCompany || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px]">{item.itemType}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{item.sqm}</TableCell>
                    <TableCell><Badge className={item.status === 'In Stock' || item.status === 'Available' ? 'bg-emerald-500' : 'bg-blue-500'}>{item.status}</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => {setSelectedItem(item); setIsDetailsOpen(true)}}><Eye className="h-3 w-3" /></Button></TableCell>
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
