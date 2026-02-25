
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Layers, FileDown, Plus } from "lucide-react"

const boms = [
  { id: 'BOM-2024-001', jobName: 'Cough Syrup 100ml', estimate: 'EST-4501', material: 'Semi-Gloss Paper', ink: 'Cyan, Magenta, Yellow, Black, UV Varnish', status: 'Approved' },
  { id: 'BOM-2024-002', jobName: 'Mineral Water Front', estimate: 'EST-4502', material: 'PE Transparent', ink: 'White, CMYK, Gloss Varnish', status: 'Pending' },
  { id: 'BOM-2024-003', jobName: 'Face Wash Gold', estimate: 'EST-4503', material: 'PP Silver', ink: 'Gold, CMYK, Matte Varnish', status: 'Draft' },
]

export default function BOMPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Bill of Materials (BOM)</h2>
          <p className="text-muted-foreground">Technical specifications and material requirements for approved estimates.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export All</Button>
          <Button><Plus className="mr-2 h-4 w-4" /> New BOM</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Active BOM Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BOM ID</TableHead>
                <TableHead>Job / Product Name</TableHead>
                <TableHead>Linked Estimate</TableHead>
                <TableHead>Primary Substrate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boms.map((bom) => (
                <TableRow key={bom.id}>
                  <TableCell className="font-mono text-xs font-bold">{bom.id}</TableCell>
                  <TableCell className="font-medium">{bom.jobName}</TableCell>
                  <TableCell className="text-muted-foreground">{bom.estimate}</TableCell>
                  <TableCell className="text-xs">{bom.material}</TableCell>
                  <TableCell>
                    <Badge variant={bom.status === 'Approved' ? 'default' : 'secondary'} className={bom.status === 'Approved' ? 'bg-emerald-500' : ''}>
                      {bom.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">View Specs</Button>
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
