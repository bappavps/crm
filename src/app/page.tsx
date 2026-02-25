
"use client"

import { useState, useEffect } from "react"
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
  Loader2
} from "lucide-react"

const data = [
  { name: 'Mon', orders: 40, production: 24, sales: 2400 },
  { name: 'Tue', orders: 30, production: 13, sales: 1398 },
  { name: 'Wed', orders: 20, production: 98, sales: 9800 },
  { name: 'Thu', orders: 27, production: 39, sales: 3908 },
  { name: 'Fri', orders: 18, production: 48, sales: 4800 },
  { name: 'Sat', orders: 23, production: 38, sales: 3800 },
];

export default function Dashboard() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h2>
          <p className="text-muted-foreground">Shree Label Creation - Live ERP Operations</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <span className="text-emerald-600 flex items-center font-medium"><ArrowUpRight className="h-3 w-3" /> +12%</span> from last week
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Production</CardTitle>
            <Factory className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42 Jobs</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <span className="text-primary flex items-center font-medium"><Clock className="h-3 w-3" /> On Track</span> 85% efficiency
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹12.5L</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <span className="text-amber-600 flex items-center font-medium">85% Usage</span> Jumbo rolls (1020mm)
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹48.2L</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <span className="text-emerald-600 flex items-center font-medium"><ArrowUpRight className="h-3 w-3" /> +18%</span> vs last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Production vs Orders</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {!isMounted ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/20" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#E4892B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="production" fill="#A33131" radius={[4, 4, 0, 0]} />
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
            {!isMounted ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/20" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#E4892B" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
