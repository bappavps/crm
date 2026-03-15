
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Legend,
  LineChart as ReLineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { 
  FileText, 
  Printer, 
  FilterX, 
  Search, 
  Loader2, 
  Boxes, 
  Weight, 
  TrendingUp, 
  Building2, 
  Layers, 
  LayoutDashboard,
  Settings2,
  PieChart as PieIcon,
  BarChart3,
  Scale,
  Maximize2,
  ChevronDown,
  FileSpreadsheet
} from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, limit, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import * as XLSX from 'xlsx'
import { format } from "date-fns"
import { ColumnHeaderFilter } from "@/components/inventory/column-header-filter"

const CHART_COLORS = ['#E4892B', '#A33131', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

const COLUMN_KEYS = [
  { id: 'rollNo', label: 'Roll No' },
  { id: 'status', label: 'Status' },
  { id: 'paperCompany', label: 'Paper Company' },
  { id: 'paperType', label: 'Paper Type' },
  { id: 'widthMm', label: 'Width (MM)' },
  { id: 'lengthMeters', label: 'Length (MTR)' },
  { id: 'sqm', label: 'SQM' },
  { id: 'gsm', label: 'GSM' },
  { id: 'weightKg', label: 'Weight (KG)' },
  { id: 'purchaseRate', label: 'Purchase Rate' },
  { id: 'receivedDate', label: 'Date Received' },
  { id: 'dateOfUsed', label: 'Date Used' },
  { id: 'jobNo', label: 'Job No' },
  { id: 'jobSize', label: 'Job Size' },
  { id: 'jobName', label: 'Job Name' },
  { id: 'lotNo', label: 'Lot / Batch No' },
  { id: 'companyRollNo', label: 'Company Roll No' },
  { id: 'remarks', label: 'Remarks' },
];

export default function AdvancedReportsPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Filtering States
  const [headerFilters, setHeaderFilters] = useState<Record<string, string[]>>({})
  const [globalSearch, setGlobalSearch] = useState("")
  
  // Analysis Controls
  const [analysisType, setAnalysisType] = useState("Status Distribution")
  const [graphField, setGraphField] = useState("paperType")

  useEffect(() => { setIsMounted(true) }, [])

  // 1. Data Fetching
  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(2000));
  }, [firestore]);

  const { data: rawRolls, isLoading } = useCollection(registryQuery);

  // 2. Filter Logic
  const filteredData = useMemo(() => {
    if (!rawRolls) return [];
    return rawRolls.filter(row => {
      // Global Search
      if (globalSearch) {
        const s = globalSearch.toLowerCase();
        const matchesGlobal = Object.values(row).some(v => String(v || "").toLowerCase().includes(s));
        if (!matchesGlobal) return false;
      }

      // Header Excel-Style Filters
      for (const [key, selected] of Object.entries(headerFilters)) {
        if (selected && selected.length > 0) {
          const val = String(row[key] || "");
          if (!selected.includes(val)) return false;
        }
      }

      return true;
    });
  }, [rawRolls, headerFilters, globalSearch]);

  // 3. Analytics Aggregation
  const metrics = useMemo(() => {
    const totalRolls = filteredData.length;
    const totalWeight = filteredData.reduce((acc, r) => acc + (Number(r.weightKg) || 0), 0);
    const totalSqm = filteredData.reduce((acc, r) => acc + (Number(r.sqm) || 0), 0);
    const totalCompanies = new Set(filteredData.map(r => r.paperCompany).filter(Boolean)).size;
    const totalPaperTypes = new Set(filteredData.map(r => r.paperType).filter(Boolean)).size;

    // Dynamic Chart Grouping
    const fieldMap = filteredData.reduce((acc: any, r) => {
      const key = String(r[graphField] || 'Unspecified');
      if (!acc[key]) acc[key] = { name: key, count: 0, sqm: 0, weight: 0 };
      acc[key].count += 1;
      acc[key].sqm += Number(r.sqm || 0);
      acc[key].weight += Number(r.weightKg || 0);
      return acc;
    }, {});

    const chartData = Object.values(fieldMap).sort((a: any, b: any) => b.sqm - a.sqm).slice(0, 10);

    return { totalRolls, totalWeight, totalSqm, totalCompanies, totalPaperTypes, chartData };
  }, [filteredData, graphField]);

  // 4. Pivot Summaries
  const companySummary = useMemo(() => {
    const map = filteredData.reduce((acc: any, r) => {
      const co = r.paperCompany || 'Unknown';
      if (!acc[co]) acc[co] = { rolls: 0, weight: 0, sqm: 0 };
      acc[co].rolls += 1;
      acc[co].weight += Number(r.weightKg || 0);
      acc[co].sqm += Number(r.sqm || 0);
      return acc;
    }, {});
    return Object.entries(map).map(([name, stats]: [string, any]) => ({ name, ...stats }));
  }, [filteredData]);

  // 5. Handlers
  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    setIsProcessing(true);
    try {
      const ws = XLSX.utils.json_to_sheet(filteredData.map(r => {
        const row: any = {};
        COLUMN_KEYS.forEach(col => row[col.label] = r[col.id]);
        return row;
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Filtered Stock");
      XLSX.writeFile(wb, `Stock_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      toast({ title: "Export Complete" });
    } catch (e) {
      toast({ variant: "destructive", title: "Export Error" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans pb-20">
      {/* 1. Dashboard Header */}
      <div className="flex items-center justify-between no-print">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Stock Intelligence Hub</h2>
          <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Multi-Perspective Inventory Analytics & Reporting</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExportExcel} disabled={isProcessing} className="h-11 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl">
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-500" />}
            Export Excel
          </Button>
          <Button onClick={handlePrint} className="h-11 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg bg-slate-900 text-white hover:bg-black">
            <Printer className="h-4 w-4 mr-2" /> Print Filtered Report
          </Button>
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 no-print">
        <MetricCard icon={Boxes} label="Total Rolls" value={metrics.totalRolls} color="text-primary" bg="bg-primary/5" />
        <MetricCard icon={Weight} label="Total Weight" value={`${metrics.totalWeight.toLocaleString()} KG`} color="text-rose-600" bg="bg-rose-50" />
        <MetricCard icon={Maximize2} label="Total SQM" value={metrics.totalSqm.toLocaleString()} color="text-emerald-600" bg="bg-emerald-50" />
        <MetricCard icon={Building2} label="Companies" value={metrics.totalCompanies} color="text-blue-600" bg="bg-blue-50" />
        <MetricCard icon={Layers} label="Paper Types" value={metrics.totalPaperTypes} color="text-purple-600" bg="bg-purple-50" />
      </div>

      {/* 3. Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
        {/* Graph Controls */}
        <Card className="lg:col-span-1 border-none shadow-xl rounded-3xl overflow-hidden bg-slate-900 text-white">
          <CardHeader className="border-b border-white/10 p-8">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-3">
              <Settings2 className="h-5 w-5 text-primary" /> Analysis Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase opacity-50">Select Analysis Type</Label>
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Status Distribution">Status Distribution</SelectItem>
                  <SelectItem value="Company Wise Stock">Company Wise Stock</SelectItem>
                  <SelectItem value="Paper Item Wise Stock">Paper Item Wise Stock</SelectItem>
                  <SelectItem value="GSM Wise Distribution">GSM Wise Distribution</SelectItem>
                  <SelectItem value="Width Wise Distribution">Width Wise Distribution</SelectItem>
                  <SelectItem value="Production Analysis">Production Usage Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase opacity-50">Select Field for Graph</Label>
              <Select value={graphField} onValueChange={setGraphField}>
                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paperCompany">Company</SelectItem>
                  <SelectItem value="paperType">Paper Item</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="gsm">GSM</SelectItem>
                  <SelectItem value="widthMm">Width</SelectItem>
                  <SelectItem value="jobName">Job Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-8 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase opacity-50">Active Dataset</p>
                  <p className="text-lg font-bold">{filteredData.length} Records</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual Analytics */}
        <Card className="lg:col-span-2 border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" /> Graphical Visualization
            </CardTitle>
            <div className="flex gap-2">
              <Badge className="bg-emerald-500 font-black text-[10px]">LIVE DATA</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              {analysisType.includes("Distribution") ? (
                <RePieChart>
                  <Pie data={metrics.chartData} dataKey="sqm" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5}>
                    {metrics.chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                </RePieChart>
              ) : (
                <ReBarChart data={metrics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                  <Bar dataKey="sqm" fill="#E4892B" radius={[6, 6, 0, 0]} barSize={40} />
                </ReBarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 4. Filter Panel & Table */}
      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden no-print">
        <CardHeader className="bg-slate-900 text-white py-6 px-8 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><FileText className="h-5 w-5 text-primary" /> Filtered Technical Registry</CardTitle>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Apply Excel-style column filters to refine report data.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input 
                placeholder="Global Keyword..." 
                className="h-9 bg-white/5 border-white/10 text-white rounded-xl pl-9 text-xs font-bold"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => setHeaderFilters({})} className="text-rose-400 hover:text-rose-300 hover:bg-white/10">
              <FilterX className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto industrial-scroll">
            <Table className="border-separate border-spacing-0 min-w-[2500px]">
              <TableHeader className="sticky top-0 bg-white z-20">
                <TableRow>
                  {COLUMN_KEYS.map((col) => (
                    <TableHead key={col.id} className="h-12 border-b border-r bg-slate-100/50 p-0">
                      <div className="flex items-center justify-between h-full px-3 gap-2">
                        <span className="font-black text-[10px] uppercase text-slate-700 tracking-tight">{col.label}</span>
                        <ColumnHeaderFilter 
                          columnKey={col.id}
                          label={col.label}
                          data={rawRolls || []}
                          selectedValues={headerFilters[col.id] || []}
                          onFilterChange={(v) => setHeaderFilters(p => ({ ...p, [col.id]: v }))}
                        />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={20} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredData.map((r, i) => (
                  <TableRow key={r.id} className="hover:bg-slate-50 transition-colors h-10">
                    {COLUMN_KEYS.map(col => (
                      <TableCell key={col.id} className="text-[11px] font-bold border-r border-b px-3 text-center">
                        {col.id === 'status' ? (
                          <Badge className={cn(
                            "text-[8px] font-black h-4 px-1.5 uppercase",
                            r.status === 'Stock' ? 'bg-emerald-500' : r.status === 'Slitting' ? 'bg-orange-500' : 'bg-slate-500'
                          )}>{r.status}</Badge>
                        ) : col.id === 'rollNo' ? (
                          <span className="text-primary font-black font-mono">{r[col.id]}</span>
                        ) : r[col.id] || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Summary Footer */}
          <div className="bg-slate-50 p-6 border-t flex items-center justify-between font-black uppercase text-[10px] tracking-widest text-slate-500">
            <div className="flex gap-10">
              <div className="flex items-center gap-2">Records: <span className="text-slate-900 text-sm">{filteredData.length}</span></div>
              <div className="flex items-center gap-2">Net SQM: <span className="text-primary text-sm">{metrics.totalSqm.toLocaleString()}</span></div>
              <div className="flex items-center gap-2">Net Weight: <span className="text-rose-600 text-sm">{metrics.totalWeight.toLocaleString()} KG</span></div>
            </div>
            <div className="italic opacity-50">Filtered Registry View</div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Printable A4 Version (Hidden on screen) */}
      <div id="print-area" className="hidden print:block p-10 bg-white text-black font-sans">
        <div className="border-b-4 border-black pb-6 flex justify-between items-end">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter">SHREE LABEL CREATION</h1>
            <p className="text-sm font-bold uppercase tracking-widest opacity-70">Industrial Technical Registry Report</p>
          </div>
          <div className="text-right space-y-1">
            <h2 className="text-xl font-black uppercase">Paper Stock Audit</h2>
            <p className="text-sm font-bold">REPORT DATE: {format(new Date(), 'dd MMM yyyy')}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-xs font-bold bg-slate-50 p-4 border rounded-lg">
          <div className="space-y-2">
            <p className="text-primary">APPLIED FILTERS:</p>
            <div className="grid grid-cols-2 gap-x-4 opacity-70 uppercase text-[9px]">
              {Object.entries(headerFilters).map(([key, val]) => val.length > 0 && (
                <p key={key}>{COLUMN_KEYS.find(c => c.id === key)?.label}: {val.join(', ')}</p>
              ))}
              {globalSearch && <p>Search: {globalSearch}</p>}
              {Object.keys(headerFilters).length === 0 && !globalSearch && <p>ALL RECORDS INCLUDED</p>}
            </div>
          </div>
          <div className="text-right flex flex-col justify-center gap-1">
            <p className="text-lg font-black">TOTAL ROLLS: {metrics.totalRolls}</p>
            <p className="text-lg font-black">TOTAL SQM: {metrics.totalSqm.toLocaleString()}</p>
            <p className="text-lg font-black">TOTAL WEIGHT: {metrics.totalWeight.toLocaleString()} KG</p>
          </div>
        </div>

        <table className="w-full mt-8 border-collapse">
          <thead>
            <tr className="bg-slate-100 border-y-2 border-black">
              <th className="p-2 text-left text-[9px] font-black uppercase border-r border-black/10">Roll No</th>
              <th className="p-2 text-left text-[9px] font-black uppercase border-r border-black/10">Company</th>
              <th className="p-2 text-left text-[9px] font-black uppercase border-r border-black/10">Paper Item</th>
              <th className="p-2 text-center text-[9px] font-black uppercase border-r border-black/10">GSM</th>
              <th className="p-2 text-center text-[9px] font-black uppercase border-r border-black/10">Width</th>
              <th className="p-2 text-center text-[9px] font-black uppercase border-r border-black/10">SQM</th>
              <th className="p-2 text-center text-[9px] font-black uppercase border-r border-black/10">Weight</th>
              <th className="p-2 text-left text-[9px] font-black uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((r, i) => (
              <tr key={i} className="border-b border-black/10 h-8">
                <td className="p-2 text-[10px] font-bold font-mono border-r border-black/10">{r.rollNo}</td>
                <td className="p-2 text-[9px] border-r border-black/10">{r.paperCompany || '-'}</td>
                <td className="p-2 text-[9px] border-r border-black/10">{r.paperType || '-'}</td>
                <td className="p-2 text-center text-[10px] border-r border-black/10">{r.gsm}</td>
                <td className="p-2 text-center text-[10px] border-r border-black/10">{r.widthMm}mm</td>
                <td className="p-2 text-center text-[10px] font-bold border-r border-black/10">{r.sqm}</td>
                <td className="p-2 text-center text-[10px] font-bold border-r border-black/10">{r.weightKg} kg</td>
                <td className="p-2 text-[9px] font-black uppercase">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-20 flex justify-between pt-10 border-t border-dashed border-black/20 text-[10px] font-black uppercase opacity-50">
          <p>Generated by {user?.displayName || user?.email}</p>
          <p>System Ver 3.0 • Confidential Management Report</p>
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
            display: block !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 10mm; }
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
