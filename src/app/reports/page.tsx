
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts"
import { 
  FileText, 
  Download, 
  Printer, 
  FilterX, 
  Search, 
  Loader2, 
  Boxes, 
  Weight, 
  PackageCheck, 
  Scissors, 
  Archive, 
  Briefcase,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Calendar,
  Settings2,
  FileSpreadsheet
} from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, limit, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import * as XLSX from 'xlsx'
import { format } from "date-fns"

const CHART_COLORS = ['#E4892B', '#A33131', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

const INITIAL_FILTERS = {
  jobName: "",
  rollNo: "",
  paperType: "",
  gsm: "",
  widthMm: "",
  lengthMeters: "",
  weightFrom: "",
  weightTo: "",
  status: "all",
  paperCompany: "",
  lotNo: "",
  receivedFrom: "",
  receivedTo: "",
  slittingStatus: "all",
  finishedStatus: "all",
  remarks: "",
  jobNo: "",
  itemCategory: "",
  search: ""
};

export default function StockReportPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isFilterExpanded, setIsFilterExpanded] = useState(true)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  // 1. Data Fetching
  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(2000));
  }, [firestore]);

  const { data: rawRolls, isLoading } = useCollection(registryQuery);

  // 2. Filtering Logic (19 Filters)
  const filteredData = useMemo(() => {
    if (!rawRolls) return [];
    return rawRolls.filter(row => {
      // Global Search
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matchesGlobal = Object.values(row).some(v => String(v || "").toLowerCase().includes(s));
        if (!matchesGlobal) return false;
      }

      // Specific Filters
      if (filters.jobName && !String(row.jobName || "").toLowerCase().includes(filters.jobName.toLowerCase())) return false;
      if (filters.rollNo && !String(row.rollNo || "").toLowerCase().includes(filters.rollNo.toLowerCase())) return false;
      if (filters.paperType && !String(row.paperType || "").toLowerCase().includes(filters.paperType.toLowerCase())) return false;
      if (filters.gsm && String(row.gsm || "") !== filters.gsm) return false;
      if (filters.widthMm && String(row.widthMm || "") !== filters.widthMm) return false;
      if (filters.lengthMeters && String(row.lengthMeters || "") !== filters.lengthMeters) return false;
      
      if (filters.weightFrom && Number(row.weightKg || 0) < Number(filters.weightFrom)) return false;
      if (filters.weightTo && Number(row.weightKg || 0) > Number(filters.weightTo)) return false;
      
      if (filters.status !== "all" && row.status !== filters.status) return false;
      if (filters.paperCompany && !String(row.paperCompany || "").toLowerCase().includes(filters.paperCompany.toLowerCase())) return false;
      if (filters.lotNo && !String(row.lotNo || "").toLowerCase().includes(filters.lotNo.toLowerCase())) return false;
      
      if (filters.receivedFrom && row.receivedDate < filters.receivedFrom) return false;
      if (filters.receivedTo && row.receivedDate > filters.receivedTo) return false;
      
      if (filters.slittingStatus !== "all" && (filters.slittingStatus === "active" ? row.status !== "Slitting" : row.status === "Slitting")) return false;
      if (filters.remarks && !String(row.remarks || "").toLowerCase().includes(filters.remarks.toLowerCase())) return false;
      if (filters.jobNo && !String(row.jobNo || "").toLowerCase().includes(filters.jobNo.toLowerCase())) return false;

      return true;
    });
  }, [rawRolls, filters]);

  // 3. Analytics Aggregation
  const metrics = useMemo(() => {
    const totalRolls = filteredData.length;
    const totalWeight = filteredData.reduce((acc, r) => acc + (Number(r.weightKg) || 0), 0);
    const available = filteredData.filter(r => r.status === 'Stock' || r.status === 'Available' || r.status === 'Main').length;
    const slitting = filteredData.filter(r => r.status === 'Slitting').length;
    const finished = filteredData.filter(r => r.status === 'Consumed' || r.status === 'Dispatched').length;
    const totalJobs = Array.from(new Set(filteredData.map(r => r.jobNo).filter(Boolean))).length;

    // Chart Data: Status
    const statusMap = filteredData.reduce((acc: any, r) => {
      const s = r.status || 'Unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const statusChart = Object.keys(statusMap).map(name => ({ name, value: statusMap[name] }));

    // Chart Data: Paper Item
    const itemMap = filteredData.reduce((acc: any, r) => {
      const s = r.paperType || 'N/A';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const itemChart = Object.keys(itemMap).map(name => ({ name, count: itemMap[name] })).sort((a, b) => b.count - a.count).slice(0, 8);

    // Chart Data: GSM
    const gsmMap = filteredData.reduce((acc: any, r) => {
      const s = r.gsm || 'N/A';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const gsmChart = Object.keys(gsmMap).map(name => ({ name: `${name} GSM`, count: gsmMap[name] })).sort((a, b) => Number(a.name.split(' ')[0]) - Number(b.name.split(' ')[0]));

    // Chart Data: Width
    const widthMap = filteredData.reduce((acc: any, r) => {
      const s = r.widthMm || 'N/A';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const widthChart = Object.keys(widthMap).map(name => ({ name: `${name}mm`, count: widthMap[name] })).sort((a, b) => Number(a.name.replace('mm','')) - Number(b.name.replace('mm','')));

    return { totalRolls, totalWeight, available, slitting, finished, totalJobs, statusChart, itemChart, gsmChart, widthChart };
  }, [filteredData]);

  // 4. Export & Print Handlers
  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    setIsProcessing(true);
    try {
      const data = filteredData.map(r => ({
        "Roll No": r.rollNo,
        "Job Name": r.jobName || "-",
        "Paper Item": r.paperType,
        "GSM": r.gsm,
        "Width (mm)": r.widthMm,
        "Length (mtr)": r.lengthMeters,
        "Weight (kg)": r.weightKg,
        "Supplier": r.paperCompany,
        "Batch/Lot": r.lotNo,
        "Status": r.status,
        "Received Date": r.receivedDate,
        "Remarks": r.remarks || "-"
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock Report");
      XLSX.writeFile(wb, `Paper_Stock_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      toast({ title: "Export Complete" });
    } catch (e) {
      toast({ variant: "destructive", title: "Export Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans pb-20">
      {/* 1. Header & Actions */}
      <div className="flex items-center justify-between no-print">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Inventory Intelligence Reports</h2>
          <p className="text-muted-foreground font-medium text-sm italic">Managerial overview of paper substrate assets and operational flow.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExportExcel} disabled={isProcessing} className="h-11 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl">
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" />}
            Export Excel
          </Button>
          <Button onClick={handlePrint} className="h-11 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg bg-slate-900 text-white hover:bg-black">
            <Printer className="h-4 w-4 mr-2" /> Print Report
          </Button>
        </div>
      </div>

      {/* 2. Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 no-print">
        <MetricCard icon={Boxes} label="Total Rolls" value={metrics.totalRolls} color="text-primary" bg="bg-primary/5" />
        <MetricCard icon={Weight} label="Total Weight (KG)" value={metrics.totalWeight.toLocaleString()} color="text-rose-600" bg="bg-rose-50" />
        <MetricCard icon={PackageCheck} label="Available" value={metrics.available} color="text-emerald-600" bg="bg-emerald-50" />
        <MetricCard icon={Scissors} label="In Slitting" value={metrics.slitting} color="text-orange-600" bg="bg-orange-50" />
        <MetricCard icon={Archive} label="Finished" value={metrics.finished} color="text-blue-600" bg="bg-blue-50" />
        <MetricCard icon={Briefcase} label="Active Jobs" value={metrics.totalJobs} color="text-purple-600" bg="bg-purple-50" />
      </div>

      {/* 3. Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-4 px-6"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-primary" /> Status Distribution</CardTitle></CardHeader>
          <CardContent className="h-[300px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={metrics.statusChart} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {metrics.statusChart.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-4 px-6"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Paper Item Distribution</CardTitle></CardHeader>
          <CardContent className="h-[300px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={metrics.itemChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                <XAxis type="number" fontSize={10} hide />
                <YAxis dataKey="name" type="category" width={100} fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#E4892B" radius={[0, 4, 4, 0]} barSize={20} />
              </ReBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-4 px-6"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> GSM Analysis</CardTitle></CardHeader>
          <CardContent className="h-[300px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={metrics.gsmChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                <YAxis fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar dataKey="count" fill="#A33131" radius={[4, 4, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-4 px-6"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Width Distribution</CardTitle></CardHeader>
          <CardContent className="h-[300px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={metrics.widthChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                <YAxis fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 4. Filter Panel (19 Filters) */}
      <Card className="border-none shadow-xl rounded-2xl no-print">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-8 border-b cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg"><FilterX className="h-4 w-4 text-primary" /></div>
            <CardTitle className="text-sm font-black uppercase tracking-tight">Advanced Report Filters</CardTitle>
          </div>
          {isFilterExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {isFilterExpanded && (
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Global Search</Label><Input placeholder="Keywords..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Job Name</Label><Input placeholder="Client Job..." value={filters.jobName} onChange={e => setFilters({...filters, jobName: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Roll Number</Label><Input placeholder="T-XXXX..." value={filters.rollNo} onChange={e => setFilters({...filters, rollNo: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Paper Item</Label><Input placeholder="Material Type..." value={filters.paperType} onChange={e => setFilters({...filters, paperType: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Supplier</Label><Input placeholder="Vendor..." value={filters.paperCompany} onChange={e => setFilters({...filters, paperCompany: e.target.value})} className="h-10 rounded-xl" /></div>
              
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Weight From</Label><Input type="number" placeholder="Min KG" value={filters.weightFrom} onChange={e => setFilters({...filters, weightFrom: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Weight To</Label><Input type="number" placeholder="Max KG" value={filters.weightTo} onChange={e => setFilters({...filters, weightTo: e.target.value})} className="h-10 rounded-xl" /></div>
              
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">GSM</Label><Input placeholder="80, 100..." value={filters.gsm} onChange={e => setFilters({...filters, gsm: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Width (MM)</Label><Input placeholder="1020, 500..." value={filters.widthMm} onChange={e => setFilters({...filters, widthMm: e.target.value})} className="h-10 rounded-xl" /></div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-50">Roll Status</Label>
                <select className="w-full h-10 px-3 rounded-xl border border-input text-xs font-bold" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                  <option value="all">All Statuses</option>
                  <option value="Main">Main</option>
                  <option value="Stock">Stock</option>
                  <option value="Slitting">Slitting</option>
                  <option value="Consumed">Consumed</option>
                </select>
              </div>

              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Received From</Label><Input type="date" value={filters.receivedFrom} onChange={e => setFilters({...filters, receivedFrom: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Received To</Label><Input type="date" value={filters.receivedTo} onChange={e => setFilters({...filters, receivedTo: e.target.value})} className="h-10 rounded-xl" /></div>
              
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Job Card No</Label><Input placeholder="JOB-XXXX..." value={filters.jobNo} onChange={e => setFilters({...filters, jobNo: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Batch Number</Label><Input placeholder="Lot ID..." value={filters.lotNo} onChange={e => setFilters({...filters, lotNo: e.target.value})} className="h-10 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Technical Remarks</Label><Input placeholder="Search comments..." value={filters.remarks} onChange={e => setFilters({...filters, remarks: e.target.value})} className="h-10 rounded-xl" /></div>
            </div>
            <div className="mt-8 flex justify-end">
              <Button variant="ghost" onClick={() => setFilters(INITIAL_FILTERS)} className="text-rose-600 font-black uppercase text-[10px] tracking-widest"><FilterX className="mr-2 h-4 w-4" /> Clear All Filters</Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 5. Data Table Section */}
      <Card className="border-none shadow-2xl rounded-2xl overflow-hidden no-print">
        <CardHeader className="bg-slate-900 text-white py-4 px-8 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> Filtered Stock Registry</CardTitle>
          <Badge className="bg-primary text-white font-black">{filteredData.length} RECORDS FOUND</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto industrial-scroll">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-black text-[10px] uppercase">Roll No</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Job Name</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Paper Item</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-center">GSM</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-center">Width</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-center">Weight</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Supplier</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Batch</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Status</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-8 w-8" /></TableCell></TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-20 text-muted-foreground font-bold italic">No data matches the current filters.</TableCell></TableRow>
                ) : filteredData.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/50 group h-10">
                    <TableCell className="font-black text-primary text-[13px] font-mono">{r.rollNo}</TableCell>
                    <TableCell className="text-[11px] font-bold truncate max-w-[150px]">{r.jobName || '-'}</TableCell>
                    <TableCell className="text-[11px] font-medium">{r.paperType}</TableCell>
                    <TableCell className="text-center font-bold text-[11px]">{r.gsm}</TableCell>
                    <TableCell className="text-center font-bold text-[11px]">{r.widthMm}mm</TableCell>
                    <TableCell className="text-center font-black text-rose-600 text-[11px]">{r.weightKg} kg</TableCell>
                    <TableCell className="text-[11px] font-medium">{r.paperCompany}</TableCell>
                    <TableCell className="text-[11px] font-mono">{r.lotNo}</TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[8px] font-black h-4 px-1.5 uppercase",
                        r.status === 'Stock' ? 'bg-emerald-500' : r.status === 'Slitting' ? 'bg-orange-500' : 'bg-slate-500'
                      )}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-medium opacity-60">{r.receivedDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 6. PRINT ONLY VIEW (A4 FORMAT) */}
      <div id="print-area" className="hidden print:block p-10 font-sans text-black">
        <div className="border-b-4 border-black pb-6 flex justify-between items-end">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter">SHREE LABEL CREATION</h1>
            <p className="text-sm font-bold uppercase tracking-widest opacity-70">Industrial Printing & Substrate ERP</p>
          </div>
          <div className="text-right space-y-1">
            <h2 className="text-xl font-black uppercase">Paper Stock Report</h2>
            <p className="text-sm font-bold">DATE: {format(new Date(), 'dd-MM-yyyy HH:mm')}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-xs font-bold bg-slate-50 p-4 border rounded-lg">
          <div className="space-y-2">
            <p>FILTERS APPLIED:</p>
            <div className="grid grid-cols-2 gap-x-4 opacity-70">
              <p>Job Name: {filters.jobName || 'ALL'}</p>
              <p>Paper Item: {filters.paperType || 'ALL'}</p>
              <p>GSM: {filters.gsm || 'ALL'}</p>
              <p>Status: {filters.status.toUpperCase()}</p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xl font-black">TOTAL ROLLS: {metrics.totalRolls}</p>
            <p className="text-xl font-black">TOTAL WEIGHT: {metrics.totalWeight.toLocaleString()} KG</p>
          </div>
        </div>

        <table className="w-full mt-8 border-collapse">
          <thead>
            <tr className="bg-slate-100 border-y-2 border-black">
              <th className="p-2 text-left text-[10px] font-black uppercase border-r border-black/10">Roll No</th>
              <th className="p-2 text-left text-[10px] font-black uppercase border-r border-black/10">Job / Client</th>
              <th className="p-2 text-left text-[10px] font-black uppercase border-r border-black/10">Item</th>
              <th className="p-2 text-center text-[10px] font-black uppercase border-r border-black/10">GSM</th>
              <th className="p-2 text-center text-[10px] font-black uppercase border-r border-black/10">Width</th>
              <th className="p-2 text-center text-[10px] font-black uppercase border-r border-black/10">Weight</th>
              <th className="p-2 text-left text-[10px] font-black uppercase border-r border-black/10">Status</th>
              <th className="p-2 text-left text-[10px] font-black uppercase">Received</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r, i) => (
              <tr key={i} className="border-b border-black/10">
                <td className="p-2 text-[10px] font-bold font-mono border-r border-black/10">{r.rollNo}</td>
                <td className="p-2 text-[9px] font-bold border-r border-black/10">{r.jobName || '-'}</td>
                <td className="p-2 text-[9px] border-r border-black/10">{r.paperType}</td>
                <td className="p-2 text-center text-[10px] font-bold border-r border-black/10">{r.gsm}</td>
                <td className="p-2 text-center text-[10px] font-bold border-r border-black/10">{r.widthMm}mm</td>
                <td className="p-2 text-center text-[10px] font-black border-r border-black/10">{r.weightKg} kg</td>
                <td className="p-2 text-[9px] font-black uppercase border-r border-black/10">{r.status}</td>
                <td className="p-2 text-[9px]">{r.receivedDate}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-20 flex justify-between pt-10 border-t border-dashed border-black/20 text-[10px] font-black uppercase opacity-50">
          <p>Generated by {user?.displayName || user?.email}</p>
          <p>System Ver 2.1 • Management Protected Document</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            display: block !important;
          }
          .no-print { display: none !important; }
          @page { size: A4; margin: 15mm; }
        }
      `}</style>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color, bg }: { icon: any, label: string, value: any, color: string, bg: string }) {
  return (
    <Card className="border-none shadow-lg rounded-2xl group hover:scale-105 transition-all duration-300">
      <CardContent className="p-6 flex flex-col items-center text-center gap-2">
        <div className={cn("p-3 rounded-2xl shadow-inner", bg)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
          <p className={cn("text-2xl font-black tracking-tighter", color)}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
