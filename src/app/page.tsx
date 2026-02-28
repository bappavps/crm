
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
import { collection, query, where, doc } from "firebase/firestore"
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

  const role = profile?.roleId || "Operator" // Default to Operator if not found
  const isAdmin = role === 'Admin' || role === 'Manager'
  const isSales = role === 'Sales' || isAdmin
  const isProduction = role === 'Operator' || isAdmin

  // 2. Live Data Queries
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !isSales) return null
    return collection(firestore, 'salesOrders')
  }, [firestore, isSales])

  const productionQuery = useMemoFirebase(() => {
    if (!firestore || !isProduction) return null
    return query(collection(firestore, 'jobs'), where("status", "==", "In Production"))
  }, [firestore, isProduction])

  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !isProduction) return null
    return collection(firestore, 'jumbo_stock')
  }, [firestore, isProduction])

  const { data: orders, isLoading: ordersLoading } = useCollection(ordersQuery)
  const { data: productionJobs, isLoading: productionLoading } = useCollection(productionQuery)
  const { data: jumboStock, isLoading: inventoryLoading } = useCollection(inventoryQuery)

  // Helper to safely parse any date format (String or Timestamp)
  const getSafeDate = (dateValue: any): Date => {
    if (!dateValue) return new Date(0)
    if (typeof dateValue.toDate === 'function') return dateValue.toDate()
    if (typeof dateValue === 'string') return parseISO(dateValue)
    return new Date(dateValue)
  }

  // 3. Metrics Aggregation
  const metrics = useMemo(() => {
    if (!isMounted) return null

    const now = new Date()
    const monthStart = startOfMonth(now)

    // Monthly Sales Calculation
    const monthlyOrders = orders?.filter(o => {
      const orderDate = getSafeDate(o.createdAt)
      return isAfter(orderDate, monthStart)
    }) || []
    
    const totalMonthlySales = monthlyOrders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0)

    // Inventory Value Calculation
    const totalInventoryValue = jumboStock?.reduce((acc, j) => {
      if (j.status === 'In Stock') {
        return acc + (Number(j.sqm || 0) * Number(j.purchaseRate || 0))
      }
      return acc
    }, 0) || 0

    // Chart Data Generation (Last 7 Days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, 6 - i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayLabel = format(d, 'EEE')

      const dayOrders = orders?.filter(o => {
        const orderDate = getSafeDate(o.createdAt)
        return format(orderDate, 'yyyy-MM-dd') === dateStr
      }).length || 0

      const daySales = orders?.filter(o => {
        const orderDate = getSafeDate(o.createdAt)
        return format(orderDate, 'yyyy-MM-dd') === dateStr
      }).reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0) || 0
      
      return {
        name: dayLabel,
        orders: dayOrders,
        production: Math.floor(dayOrders * 0.8), // Simulated production trend based on actual orders
        sales: daySales
      }
    })

    return {
      newOrders: orders?.length || 0,
      inProduction: productionJobs?.length || 0,
      monthlySales: totalMonthlySales,
      inventoryValue: totalInventoryValue,
      chartData: last7Days
    }
  }, [isMounted, orders, productionJobs, jumboStock])

  if (!isMounted || profileLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Live Dashboard</h2>
          <p className="text-muted-foreground">Operational Intelligence for {profile?.firstName} ({role})</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Sales Logic: Show New Orders and Monthly Sales */}
        {isSales && (
          <>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {ordersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : metrics?.newOrders}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  Total system order book
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {ordersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `₹${(metrics?.monthlySales! / 100000).toFixed(1)}L`}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <span className="text-emerald-600 flex items-center font-medium"><ArrowUpRight className="h-3 w-3" /> Live</span> current month
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Production Logic: Show In Production and Inventory Value */}
        {isProduction && (
          <>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Production</CardTitle>
                <Factory className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {productionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${metrics?.inProduction} Jobs`}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <span className="text-primary flex items-center font-medium"><Clock className="h-3 w-3" /> Active</span> on floor
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {inventoryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `₹${(metrics?.inventoryValue! / 100000).toFixed(1)}L`}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  Estimated jumbo asset value
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Activity Trends (7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {ordersLoading ? (
              <Loader2 className="animate-spin text-muted-foreground" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#E4892B" name="Orders" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="production" fill="#A33131" name="Output" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Revenue Stream</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {ordersLoading ? (
              <Loader2 className="animate-spin text-muted-foreground" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics?.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" name="Sales (₹)" stroke="#E4892B" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {!isAdmin && (
        <div className="p-4 bg-muted/30 rounded-lg border border-dashed flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-bold uppercase mb-1">Restricted View</p>
            <p>Your dashboard is tailored to your role as <strong>{role}</strong>. Financial and operational cards are hidden or visible based on your permissions.</p>
          </div>
        </div>
      )}
    </div>
  )
}
