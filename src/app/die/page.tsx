
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wrench, Plus, History } from "lucide-react"

export default function DieManagementPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Die Management</h2>
          <p className="text-muted-foreground">Inventory and lifecycle tracking of rotary/flatbed dies.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Add New Die</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" /> Die Tooling Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Die ID</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>Shape</TableHead>
                <TableHead>Labels Across</TableHead>
                <TableHead>Usage Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-bold">DIE-R-50100</TableCell>
                <TableCell>50mm x 100mm</TableCell>
                <TableCell>Rectangle</TableCell>
                <TableCell>2</TableCell>
                <TableCell>1,25,000 m</TableCell>
                <TableCell><Badge className="bg-emerald-500">Good</Badge></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm"><History className="h-3 w-3 mr-1" /> Life</Button></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold">DIE-C-3030</TableCell>
                <TableCell>30mm Dia</TableCell>
                <TableCell>Circle</TableCell>
                <TableCell>5</TableCell>
                <TableCell>4,80,000 m</TableCell>
                <TableCell><Badge variant="secondary">Maintenance</Badge></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm"><History className="h-3 w-3 mr-1" /> Life</Button></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
