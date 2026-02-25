
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog"
import { Settings, Users, Database, Box, Plus, TrendingUp, Ruler } from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"

export default function MasterDataPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"materials" | "machines" | "customers" | "cylinders">("materials")

  // Firestore Queries
  const materialsQuery = useMemoFirebase(() => collection(firestore!, 'materials'), [firestore])
  const machinesQuery = useMemoFirebase(() => collection(firestore!, 'machines'), [firestore])
  const customersQuery = useMemoFirebase(() => collection(firestore!, 'customers'), [firestore])
  const cylindersQuery = useMemoFirebase(() => collection(firestore!, 'cylinders'), [firestore])

  const { data: materials } = useCollection(materialsQuery)
  const { data: machines } = useCollection(machinesQuery)
  const { data: customers } = useCollection(customersQuery)
  const { data: cylinders } = useCollection(cylindersQuery)

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())
    
    if (!firestore || !user) return

    const colRef = collection(firestore, dialogType)
    addDocumentNonBlocking(colRef, {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdById: user.uid
    })

    setIsDialogOpen(false)
    toast({
      title: "Master Data Updated",
      description: `New ${dialogType.slice(0, -1)} has been added successfully.`,
    })
  }

  const openAddDialog = (type: "materials" | "machines" | "customers" | "cylinders") => {
    setDialogType(type)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Master Data Management</h2>
          <p className="text-muted-foreground">Configure global constants, machines, and industry rates.</p>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Add New {dialogType.charAt(0).toUpperCase() + dialogType.slice(1, -1)}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {dialogType === "materials" && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gsm" className="text-right">GSM</Label>
                    <Input id="gsm" name="gsm" type="number" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ratePerSqMeter" className="text-right">Rate/sqm</Label>
                    <Input id="ratePerSqMeter" name="ratePerSqMeter" type="number" step="0.01" className="col-span-3" required />
                  </div>
                  <input type="hidden" name="type" value="Substrate" />
                  <input type="hidden" name="unitOfMeasure" value="sq meter" />
                  <input type="hidden" name="description" value="Added via Master Data" />
                </>
              )}
              {dialogType === "machines" && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="maxPrintingWidthMm" className="text-right">Max Width</Label>
                    <Input id="maxPrintingWidthMm" name="maxPrintingWidthMm" type="number" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="costPerHour" className="text-right">Cost/hr</Label>
                    <Input id="costPerHour" name="costPerHour" type="number" className="col-span-3" required />
                  </div>
                  <input type="hidden" name="type" value="Printing Machine" />
                  <input type="hidden" name="speedMetersPerMin" value="100" />
                  <input type="hidden" name="description" value="Narrow Web Flexo" />
                </>
              )}
              {dialogType === "customers" && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Company</Label>
                    <Input id="name" name="name" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gstNumber" className="text-right">GST No.</Label>
                    <Input id="gstNumber" name="gstNumber" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" name="email" type="email" className="col-span-3" required />
                  </div>
                  <input type="hidden" name="contactPerson" value="Manager" />
                  <input type="hidden" name="phone" value="N/A" />
                  <input type="hidden" name="address" value="N/A" />
                </>
              )}
              {dialogType === "cylinders" && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" className="col-span-3" placeholder="e.g. Cyl 508" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="repeatLengthMm" className="text-right">Repeat (mm)</Label>
                    <Input id="repeatLengthMm" name="repeatLengthMm" type="number" className="col-span-3" required />
                  </div>
                  <input type="hidden" name="description" value="Flexo Cylinder" />
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[850px]">
          <TabsTrigger value="materials" className="flex items-center gap-2"><Database className="h-4 w-4" /> Materials</TabsTrigger>
          <TabsTrigger value="machines" className="flex items-center gap-2"><Box className="h-4 w-4" /> Machines</TabsTrigger>
          <TabsTrigger value="cylinders" className="flex items-center gap-2"><Ruler className="h-4 w-4" /> Cylinders</TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2"><Users className="h-4 w-4" /> Clients</TabsTrigger>
          <TabsTrigger value="rates" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Rates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="materials" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Material Registry</CardTitle>
              <Button size="sm" onClick={() => openAddDialog("materials")}><Plus className="h-4 w-4 mr-2" /> Add Material</Button>
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
                  {materials?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.gsm}</TableCell>
                      <TableCell>₹{m.ratePerSqMeter}</TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                    </TableRow>
                  ))}
                  {(!materials || materials.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No materials found. Click Add to create one.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="machines" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Machine Configuration</CardTitle>
              <Button size="sm" onClick={() => openAddDialog("machines")}><Plus className="h-4 w-4 mr-2" /> Add Machine</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine Name</TableHead>
                    <TableHead>Max Width</TableHead>
                    <TableHead>Cost/hr</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machines?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.maxPrintingWidthMm}mm</TableCell>
                      <TableCell>₹{m.costPerHour}</TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cylinders" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Cylinder Library</CardTitle>
              <Button size="sm" onClick={() => openAddDialog("cylinders")}><Plus className="h-4 w-4 mr-2" /> Add Cylinder</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Repeat Length</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cylinders?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.repeatLengthMm}mm</TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Customer Master</CardTitle>
              <Button size="sm" onClick={() => openAddDialog("customers")}><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>GST No.</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.gstNumber}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-primary">Global Operation Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-primary/5">
                  <h4 className="font-bold text-primary mb-2">Printing Rate</h4>
                  <p className="text-2xl font-black">₹1.50 <span className="text-xs text-muted-foreground font-normal">/meter</span></p>
                </div>
                <div className="p-4 border rounded-lg bg-accent/5">
                  <h4 className="font-bold text-accent mb-2">UV Coating Rate</h4>
                  <p className="text-2xl font-black">₹0.50 <span className="text-xs text-muted-foreground font-normal">/meter</span></p>
                </div>
                <div className="p-4 border rounded-lg bg-emerald-50">
                  <h4 className="font-bold text-emerald-600 mb-2">Labor Rate</h4>
                  <p className="text-2xl font-black">₹500 <span className="text-xs text-muted-foreground font-normal">/hour</span></p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Standard Jumbo Width (mm)</label>
                    <Input defaultValue="1020" readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Default Side Margin (mm)</label>
                    <Input defaultValue="5" />
                  </div>
                </div>
                <Button className="mt-4" onClick={() => toast({title: "Settings Saved", description: "Global constants updated."})}>Update Configuration</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
