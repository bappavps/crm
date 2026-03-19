
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  LineChart as ReLineChart, 
  Line, 
  Legend 
} from "recharts"
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Activity, 
  ArrowUpRight, 
  DollarSign, 
  Loader2,
  FilterX,
  Search,
  CheckCircle2,
  Clock
} from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where, limit, updateDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const COLORS = ['#E4892B', '#A33131', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

export default function StockDashboard() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => { setIsMounted(true) }, [])

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Optimized query: Standardized to paper_stock and expanded limit
  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return query(collection(firestore, 'paper_stock'), limit(1000));
  }, [firestore, user, adminData]);

  const alertsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return query(collection(firestore, 'alerts'), where("resolved", "==", false), limit(100));
  }, [firestore, user, adminData]);

  const { data: jumbos, isLoading: itemsLoading } = useCollection(jumboQuery)
  const { data: alerts, isLoading: alertsLoading } = useCollection(alertsQuery)

  const metrics = useMemo(() => {
    if (!jumbos) return null;
    let filtered = [...jumbos];
    if (searchQuery) filtered = filtered.filter(j => j.rollNo.toLowerCase().includes(searchQuery.toLowerCase()));

    const totalRolls = filtered.length;
    const totalSqm = filtered.reduce((acc, j) => acc + (Number(j.sqm) || 0), 0);
    const totalValue = filtered.reduce((acc, j) => acc + ((Number(j.purchaseRate) || 0) * (Number(j.sqm) || 0)), 0);
    const lowStockCount = filtered.filter(j => (Number(j.sqm) || 0) < 100).length;

    const typeDistribution = filtered.reduce((acc: any, j) => {
      acc[j.paperType] = (acc[j.paperType] || 0) + 1;
      return acc;
    }, {});
    const barData = Object.keys(typeDistribution).map(key => ({ name: key, count: typeDistribution[key] })).slice(0, 5);

    const pieData = Object.keys(typeDistribution).map(key => ({ name: key, value: typeDistribution[key] })).slice(0, 6);

    return { totalRolls, totalSqm, totalValue, lowStockCount, barData, pieData };
  }, [jumbos, searchQuery]);

  const handleResolveAlert = async (alertId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'alerts', alertId), { resolved: true, resolvedAt: new Date().toISOString() });
    toast({ title: "Alert Resolved" });
  };

  if (!isMounted || itemsLoading) return <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>
  if (!adminData) return <div className="p-20 text-center">Admin Access Required.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-3xl font-bold tracking-tight text-primary">Inventory Analytics</h2></div>
        <div className="flex gap-2">
          <div className="relative w-64"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search Roll ID..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm"><CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total SQM</CardTitle><Activity className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-primary">{metrics?.totalSqm.toLocaleString()}</div></CardContent></Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm"><CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Estimated Value</CardTitle><DollarSign className="h-4 w-4 text-emerald-500" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-emerald-600">₹{metrics?.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></CardContent></Card>
        <Card className="border-l-4 border-l-destructive shadow-sm"><CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Low Stock Flags</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-3xl font-black text-destructive">{metrics?.lowStockCount}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle className="text-sm font-bold uppercase">Substrate Distribution</CardTitle></CardHeader>
          <CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><ReBarChart data={metrics?.barData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="count" fill="#E4892B" radius={[4, 4, 0, 0]} /></ReBarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-bold uppercase">Inventory Alerts</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[250px] overflow-auto">{alerts && alerts.length > 0 ? alerts.map(a => <div key={a.id} className="p-3 border-b text-xs flex justify-between items-center"><span>Roll {a.rollId}: {a.message}</span><Button size="sm" variant="ghost" onClick={() => handleResolveAlert(a.id)}><CheckCircle2 className="h-3 w-3" /></Button></div>) : <p className="p-10 text-center text-muted-foreground">No active alerts.</p>}</CardContent></Card>
      </div>
    </div>
  )
}
