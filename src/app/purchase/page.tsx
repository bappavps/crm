
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, Plus } from "lucide-react"

export default function PurchasePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Purchase Management</h2>
          <p className="text-muted-foreground">Procurement of raw materials and consumables.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Create PO</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-bold">PO-7701</TableCell>
                <TableCell>Avery Dennison</TableCell>
                <TableCell>Semi-Gloss Paper (1020mm)</TableCell>
                <TableCell>2024-05-18</TableCell>
                <TableCell><Badge>Received</Badge></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm">Invoice</Button></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold">PO-7702</TableCell>
                <TableCell>Uflex Ltd</TableCell>
                <TableCell>PET Film 12 Micron</TableCell>
                <TableCell>2024-05-20</TableCell>
                <TableCell><Badge variant="outline">Ordered</Badge></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm">Track</Button></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
