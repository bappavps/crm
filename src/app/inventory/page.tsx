"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Filter, QrCode } from "lucide-react"

const stock = [
  { id: 'INV-001', name: 'Semi-Gloss Paper', category: 'Jumbo Roll', width: '1020mm', length: '4000m', qty: 12, status: 'In Stock' },
  { id: 'INV-002', name: 'PE Transparent', category: 'Jumbo Roll', width: '1020mm', length: '3000m', qty: 5, status: 'In Stock' },
  { id: 'INV-003', name: 'Thermal Eco', category: 'Slitted Roll', width: '250mm', length: '1000m', qty: 45, status: 'Low Stock' },
  { id: 'INV-004', name: 'PP Silver', category: 'Jumbo Roll', width: '1020mm', length: '2000m', qty: 0, status: 'Out of Stock' },
  { id: 'INV-005', name: 'BOPP White', category: 'WIP', width: '250mm', length: '1500m', qty: 8, status: 'In Production' },
]

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Inventory Management</h2>
          <p className="text-muted-foreground">Track Jumbo Rolls, Slitted Rolls, and Finished Goods.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><QrCode className="mr-2 h-4 w-4" /> Scan Barcode</Button>
          <Button><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stock Registry</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search inventory..." className="pl-8 w-[250px]" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU ID</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-bold">{item.id}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.category}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{item.width} x {item.length}</TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell>
                    <Badge className={
                      item.status === 'In Stock' ? 'bg-emerald-500' : 
                      item.status === 'Low Stock' ? 'bg-amber-500' : 
                      item.status === 'Out of Stock' ? 'bg-destructive' : 'bg-primary'
                    }>
                      {item.status}
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