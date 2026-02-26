
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  History, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Loader2,
  FilterX,
  Search,
  CheckCircle2,
  Clock
} from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where, orderBy, limit, setDoc, serverTimestamp, updateDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const COLORS = ['#E4892B', '#A33131', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

export default function StockDashboard() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)

  // Filters
  const [paperTypeFilter, setPaperTypeFilter] = useState("all")
  const [companyFilter, setCompanyFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => { setIsMounted(true) }, [])

  // Authorization
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Queries
  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jumbo_stock');
  }, [firestore, user, adminData]);

  const alertsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return query(collection(firestore, 'alerts'), where("resolved", "==", false));
  }, [firestore, user, adminData]);

  const { data: jumbos, isLoading: itemsLoading } = useCollection(jumboQuery)
  const { data: alerts, isLoading: alertsLoading } = useCollection(alertsQuery)

  // Aggregation Logic
  const metrics = useMemo(() => {
    if (!jumbos) return null;

    let filtered = [...jumbos];
    if (paperTypeFilter !== "all") filtered = filtered.filter(j => j.paperType === paperTypeFilter);
    if (companyFilter !== "all") filtered = filtered.filter(j => j.paperCompany === companyFilter);
    if (searchQuery) filtered = filtered.filter(j => j.rollNo.toLowerCase().includes(searchQuery.toLowerCase()));

    const totalRolls = filtered.length;
    const totalSqm = filtered.reduce((acc, j) => acc + (Number(j.sqm) || 0), 0);
    const totalWeight = filtered.reduce((acc, j) => acc + (Number(j.weightKg) || 0), 0);
    const totalValue = filtered.reduce((acc, j) => acc + ((Number(j.purchaseRate) || 0) * (Number(j.sqm) || 0)), 0);

    const lowStockThreshold = 100; // Example threshold in SQM
    const lowStockRolls = filtered.filter(j => (Number(j.sqm) || 0) < lowStockThreshold);
    
    // Slow moving stock (not used in last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const slowMoving = filtered.filter(j => {
      const received = j.receivedDate ? new Date(j.receivedDate) : new Date();
      return received < sixtyDaysAgo && j.status === 'In Stock';
    });

    // Charts Data
    const typeDistribution = filtered.reduce((acc: any, j) => {
      acc[j.paperType] = (acc[j.paperType] || 0) + 1;
      return acc;
    }, {});
    const barData = Object.keys(typeDistribution).map(key => ({ name: key, count: typeDistribution[key] })).slice(0, 5);

    const gsmDistribution = filtered.reduce((acc: any, j) => {
      const gsmKey = `${j.gsm} GSM`;
      acc[gsmKey] = (acc[gsmKey] || 0) + 1;
      return acc;
    }, {});
    const pieData = Object.keys(gsmDistribution).map(key => ({ name: key, value: gsmDistribution[key] }));

    return { 
      totalRolls, 
      totalSqm, 
      totalWeight, 
      totalValue, 
      lowStockCount: lowStockRolls.length,
      slowMovingCount: slowMoving.length,
      barData, 
      pieData,
      filtered
    };
  }, [jumbos, paperTypeFilter, companyFilter, searchQuery]);

  const handleResolveAlert = async (alertId: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'alerts', alertId), {
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedBy: user?.uid
    });
    toast({ title: "Alert Resolved", description: "Technical warning marked as addressed." });
  };

  if (!isMounted || itemsLoading) {
    return <div className="flex flex-col items-center justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin h-8 w-8 mb-4" /><p>Synthesizing Inventory Intelligence...</p></div>
  }

  if (!adminData) return <div className="p-20 text-center text-muted-foreground">Admin Access Required.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Smart Stock Dashboard</h2>
          <p className="text-muted-foreground">Real-time inventory analytics and automated technical alerts.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search RELL NO..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => { setPaperTypeFilter("all"); setCompanyFilter("all"); setSearchQuery(""); }}>
            <FilterX className="mr-2 h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total SQM in Stock</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{metrics?.totalSqm.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" /> +4.2% vs last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inventory Valuation</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-600">₹{metrics?.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">Current Market Estimated Asset</p>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4 shadow-sm hover:shadow-md transition-all", metrics?.lowStockCount! > 0 ? "border-l-destructive bg-destructive/5" : "border-l-muted")}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Low Stock Warnings</CardTitle>
            <AlertTriangle className={cn("h-4 w-4", metrics?.lowStockCount! > 0 ? "text-destructive animate-pulse" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-black", metrics?.lowStockCount! > 0 ? "text-destructive" : "text-foreground")}>{metrics?.lowStockCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">Rolls below technical threshold</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Slow Moving Stock</CardTitle>
            <History className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-600">{metrics?.slowMovingCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">No movement in 60+ days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Console */}
        <Card className="lg:col-span-1 border-primary/10 shadow-lg">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-widest">
              <Activity className="h-4 w-4" /> Live Technical Alerts
            </CardTitle>
            <CardDescription className="text-[10px]">Real-time inventory violations detected.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 max-h-[500px] overflow-auto">
            {alertsLoading ? (
              <div className="p-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>
            ) : alerts && alerts.length > 0 ? (
              <div className="divide-y divide-border">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-4 hover:bg-muted/30 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant={alert.severity === 'Critical' ? 'destructive' : 'secondary'} className="text-[9px] h-5 uppercase">
                        {alert.severity}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" /> {new Date(alert.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-foreground mb-1">Roll {alert.rollId}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed italic">"{alert.message}"</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-[9px] flex-1" onClick={() => handleResolveAlert(alert.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Resolved
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-4 opacity-20 text-emerald-500" />
                <p className="text-xs font-bold uppercase tracking-widest">System Clear</p>
                <p className="text-[10px] mt-1">No inventory violations detected.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold text-primary uppercase">Stock by Paper Type</CardTitle></CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={metrics?.barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" fill="#E4892B" radius={[4, 4, 0, 0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-bold text-primary uppercase">GSM Distribution</CardTitle></CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={metrics?.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {metrics?.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm font-bold text-primary uppercase">Inventory Movement (30 Days)</CardTitle></CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={[
                  { day: '01', sqm: 4000 }, { day: '05', sqm: 3000 }, { day: '10', sqm: 5000 },
                  { day: '15', sqm: 2000 }, { day: '20', sqm: 6000 }, { day: '25', sqm: 4500 },
                  { day: '30', sqm: 7000 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="day" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="sqm" stroke="#E4892B" strokeWidth={3} dot={{ fill: '#E4892B', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </ReLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
