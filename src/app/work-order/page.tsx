
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClipboardList, Plus } from "lucide-react"

const workOrders = [
  { id: 'WO-5001', job: 'Cough Syrup 100ml', type: 'Reprint', machine: 'FLEXO-01', priority: 'High', status: 'Scheduled' },
  { id: 'WO-5002', job: 'Mineral Water Front', type: 'New', machine: 'FLEXO-02', priority: 'Medium', status: 'In Preparation' },
  { id: 'WO-5003', job: 'Face Wash Gold', type: 'Modification', machine: 'FLEXO-01', priority: 'Low', status: 'Draft' },
]

export default function WorkOrderPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Work Orders</h2>
          <p className="text-muted-foreground">Planning and scheduling production tasks.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Work Order</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Active Work Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO ID</TableHead>
                <TableHead>Job Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell className="font-bold">{wo.id}</TableCell>
                  <TableCell>{wo.job}</TableCell>
                  <TableCell><Badge variant="outline">{wo.type}</Badge></TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold ${wo.priority === 'High' ? 'text-destructive' : wo.priority === 'Medium' ? 'text-primary' : 'text-emerald-600'}`}>
                      {wo.priority}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{wo.machine}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{wo.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Plan</Button>
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
