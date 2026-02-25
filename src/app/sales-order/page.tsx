
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

const orders = [
  { id: 'SO-9001', client: 'PharmaTech India', date: '2024-05-20', qty: '50,000', value: '₹1,25,000', status: 'Confirmed' },
  { id: 'SO-9002', client: 'EcoDrinks Ltd', date: '2024-05-21', qty: '1,00,000', value: '₹2,10,000', status: 'Pending' },
  { id: 'SO-9003', client: 'BeautyLine Cosme', date: '2024-05-22', qty: '20,000', value: '₹85,000', status: 'In Production' },
]

export default function SalesOrderPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Sales Orders</h2>
          <p className="text-muted-foreground">Manage customer orders and conversion from estimates.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Sales Order</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Order History
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-bold">{order.id}</TableCell>
                  <TableCell>{order.client}</TableCell>
                  <TableCell>{order.date}</TableCell>
                  <TableCell>{order.qty}</TableCell>
                  <TableCell className="font-semibold text-primary">{order.value}</TableCell>
                  <TableCell>
                    <Badge className={order.status === 'Confirmed' ? 'bg-blue-500' : order.status === 'In Production' ? 'bg-primary' : 'bg-amber-500'}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Details</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
