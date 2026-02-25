
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Settings, Users, Database, Box, Plus, TrendingUp } from "lucide-react"

export default function MasterDataPage() {
  const { toast } = useToast()

  const handleAdd = (type: string) => {
    toast({
      title: `Add New ${type}`,
      description: `Opening entry form for ${type} master.`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Master Data Management</h2>
          <p className="text-muted-foreground">Configure global constants, machines, and industry rates.</p>
        </div>
      </div>

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[800px]">
          <TabsTrigger value="materials" className="flex items-center gap-2"><Database className="h-4 w-4" /> Materials</TabsTrigger>
          <TabsTrigger value="machines" className="flex items-center gap-2"><Box className="h-4 w-4" /> Machines</TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2"><Users className="h-4 w-4" /> Clients</TabsTrigger>
          <TabsTrigger value="rates" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Rates</TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2"><Settings className="h-4 w-4" /> System</TabsTrigger>
        </TabsList>
        
        <TabsContent value="materials" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Material Registry</CardTitle>
              <Button size="sm" onClick={() => handleAdd("Material")}><Plus className="h-4 w-4 mr-2" /> Add Material</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Substrate Name</TableHead>
                    <TableHead>GSM</TableHead>
                    <TableHead>Rate (₹/sqm)</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Semi-Gloss Paper</TableCell>
                    <TableCell>80</TableCell>
                    <TableCell>₹24.50</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">PE Transparent</TableCell>
                    <TableCell>60</TableCell>
                    <TableCell>₹42.00</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="machines" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Machine Configuration</CardTitle>
              <Button size="sm" onClick={() => handleAdd("Machine")}><Plus className="h-4 w-4 mr-2" /> Add Machine</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine Name</TableHead>
                    <TableHead>Max Width</TableHead>
                    <TableHead>Speed (m/min)</TableHead>
                    <TableHead>Cost/hr</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">UV Flexo 8-Color</TableCell>
                    <TableCell>250mm</TableCell>
                    <TableCell>100</TableCell>
                    <TableCell>₹1,800</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Customer Master</CardTitle>
              <Button size="sm" onClick={() => handleAdd("Customer")}><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>GST No.</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">PharmaTech India</TableCell>
                    <TableCell>27AAACP0001A1Z</TableCell>
                    <TableCell>Rajesh V.</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Operation Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-bold text-primary mb-2">Printing Rate</h4>
                  <p className="text-2xl font-black">₹1.50 <span className="text-xs text-muted-foreground">/meter</span></p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-bold text-accent mb-2">UV Coating Rate</h4>
                  <p className="text-2xl font-black">₹0.50 <span className="text-xs text-muted-foreground">/meter</span></p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-bold text-emerald-600 mb-2">Labor Rate</h4>
                  <p className="text-2xl font-black">₹500 <span className="text-xs text-muted-foreground">/hour</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="pt-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Global Parameters</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Standard Jumbo Width (mm)</label>
                  <Input defaultValue="1020" readOnly />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Default Side Margin (mm)</label>
                  <Input defaultValue="5" />
                </div>
              </div>
              <Button onClick={() => toast({title: "Settings Saved", description: "Global constants updated."})}>Update Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
