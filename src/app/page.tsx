
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line
} from "recharts"
import { 
  ShoppingCart, 
  Factory, 
  Package, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  Loader2,
  AlertCircle
} from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, where, doc, limit, orderBy } from "firebase/firestore"
import { startOfMonth, subDays, format, isAfter, parseISO } from "date-fns"

export default function Dashboard() {
  const [isMounted, setIsMounted] = useState(false)
  const firestore = useFirestore()
  const { user } = useUser()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 1. Get User Role
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null
    return doc(firestore, 'users', user.uid)
  }, [firestore, user])
  const { data: profile, isLoading: profileLoading } = useDoc(userProfileRef)

  const role = profile?.roleId || "Operator" 
  const isAdmin = role === 'Admin' || role === 'Manager' || profile?.roles?.includes('Admin')
  const isSales = role === 'Sales' || isAdmin || profile?.roles?.includes('Sales')
  const isProduction = role === 'Operator' || isAdmin || profile?.roles?.includes('Operator')

  // 2. Live Data Queries - Optimized with expanded limits
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !isSales) return null
    return query(collection(firestore, 'salesOrders'), orderBy('createdAt', 'desc'), limit(10000))
  }, [firestore, isSales])

  const productionQuery = useMemoFirebase(() => {
    if (!firestore || !isProduction) return null
    return query(collection(firestore, 'jobs'), where("status", "==", "In Production"), limit(5000))
  }, [firestore, isProduction])

  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !isProduction) return null
    return query(collection(firestore, 'paper_stock'), limit(10000))
  }, [firestore, isProduction])

  const { data: orders, isLoading: ordersLoading } = useCollection(ordersQuery)
  const { data: productionJobs, isLoading: productionLoading } = useCollection(productionQuery)
  const { data: paperStock, isLoading: inventoryLoading } = useCollection(inventoryQuery)

  const getSafeDate = (dateValue: any): Date => {
    if (!dateValue) return new Date(0)
    if (dateValue instanceof Date) return dateValue
    if (typeof dateValue.toDate === 'function') return dateValue.toDate()
    if (dateValue && typeof dateValue.seconds === 'number') return new Date(dateValue.seconds * 1000)
    if (typeof dateValue === 'string') {
      try { return parseISO(dateValue) } catch (e) { 
        const d = new Date(dateValue); return isNaN(d.getTime()) ? new Date(0) : d 
      }
    }
    const fallback = new Date(dateValue)
    return isNaN(fallback.getTime()) ? new Date(0) : fallback
  }

  // 3. Metrics Aggregation
  const metrics = useMemo(() => {
    if (!isMounted) return null
    const now = new Date()
    const monthStart = startOfMonth(now)

    const monthlyOrders = orders?.filter(o => isAfter(getSafeDate(o.createdAt), monthStart)) || []
    const totalMonthlySales = monthlyOrders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0)

    const totalInventoryValue = paperStock?.reduce((acc, j) => {
      if (j.status === 'Available' || j.status === 'Stock') return acc + (Number(j.sqm || 0) * Number(j.purchaseRate || 0))
      return acc
    }, 0) || 0

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, 6 - i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayLabel = format(d, 'EEE')
      const dayOrders = orders?.filter(o => format(getSafeDate(o.createdAt), 'yyyy-MM-dd') === dateStr).length || 0
      const daySales = orders?.filter(o => format(getSafeDate(o.createdAt), 'yyyy-MM-dd') === dateStr).reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0) || 0
      return { name: dayLabel, orders: dayOrders, production: Math.floor(dayOrders * 0.8), sales: daySales }
    })

    return { newOrders: orders?.length || 0, inProduction: productionJobs?.length || 0, monthlySales: totalMonthlySales, inventoryValue: totalInventoryValue, chartData: last7Days }
  }, [isMounted, orders, productionJobs, paperStock])

  if (!isMounted || profileLoading) return <div className="flex h-[calc(100vh-10rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Live Dashboard</h2>
          <p className="text-muted-foreground">Operational Intelligence for {profile?.firstName} ({role})</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isSales && (
          <>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Active Pipeline</CardTitle><ShoppingCart className="h-4 w-4 text-primary" /></CardHeader>
              <CardContent><div className="text-2xl font-bold">{ordersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : metrics?.newOrders}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Monthly Sales</CardTitle><TrendingUp className="h-4 w-4 text-primary" /></CardHeader>
              <CardContent><div className="text-2xl font-bold text-emerald-600">{ordersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `₹${(metrics?.monthlySales! / 100000).toFixed(1)}L`}</div></CardContent></Card>
          </>
        )}
        {isProduction && (
          <>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">In Production</CardTitle><Factory className="h-4 w-4 text-primary" /></CardHeader>
              <CardContent><div className="text-2xl font-bold">{productionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${metrics?.inProduction} Jobs`}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Inventory Snapshot</CardTitle><Package className="h-4 w-4 text-primary" /></CardHeader>
              <CardContent><div className="text-2xl font-bold text-amber-600">{inventoryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `₹${(metrics?.inventoryValue! / 100000).toFixed(1)}L`}</div></CardContent></Card>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4"><CardHeader><CardTitle>Activity Trends (7 Days)</CardTitle></CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {ordersLoading ? <Loader2 className="animate-spin text-muted-foreground" /> : <ResponsiveContainer width="100%" height="100%"><BarChart data={metrics?.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="orders" fill="#E4892B" radius={[4, 4, 0, 0]} /><Bar dataKey="production" fill="#A33131" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}
          </CardContent></Card>
        <Card className="col-span-3"><CardHeader><CardTitle>Revenue Stream</CardTitle></CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {ordersLoading ? <Loader2 className="animate-spin text-muted-foreground" /> : <ResponsiveContainer width="100%" height="100%"><LineChart data={metrics?.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="sales" stroke="#E4892B" strokeWidth={2} /></LineChart></ResponsiveContainer>}
          </CardContent></Card>
      </div>
    </div>
  )
}
