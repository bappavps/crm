
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wrench, Plus, History, Loader2 } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function DieManagementPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries
  const diesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'dies');
  }, [firestore, user, adminData])

  const { data: dies, isLoading: diesLoading } = useCollection(diesQuery)

  const handleAddDie = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    
    const dieData = {
      name: formData.get("name") as string,
      shape: formData.get("shape") as string,
      dimensions: formData.get("dimensions") as string,
      labelsAcross: Number(formData.get("labelsAcross")),
      cost: Number(formData.get("cost")),
      status: formData.get("status") as string,
      description: `Die tool: ${formData.get("dimensions")}`,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      createdById: user.uid
    }

    addDocumentNonBlocking(collection(firestore, 'dies'), dieData)

    setIsDialogOpen(false)
    toast({
      title: "Die Added",
      description: `${dieData.name} has been added to the tooling library.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Die Management</h2>
          <p className="text-muted-foreground">Inventory and lifecycle tracking of rotary/flatbed dies.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add New Die</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddDie}>
            <DialogHeader>
              <DialogTitle>Add New Die Tool</DialogTitle>
              <DialogDescription>Register a new cutting die with dimensions and layout specs.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Die SKU / ID</Label>
                <Input id="name" name="name" placeholder="e.g. DIE-R-50100" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="shape">Shape</Label>
                  <Select name="shape" defaultValue="Rectangle">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rectangle">Rectangle</SelectItem>
                      <SelectItem value="Circle">Circle</SelectItem>
                      <SelectItem value="Oval">Oval</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="labelsAcross">Labels Across</Label>
                  <Input id="labelsAcross" name="labelsAcross" type="number" defaultValue="1" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dimensions">Dimensions (e.g. 50mm x 100mm)</Label>
                <Input id="dimensions" name="dimensions" placeholder="50x100" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cost">Purchase Cost (₹)</Label>
                  <Input id="cost" name="cost" type="number" placeholder="0.00" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue="Available">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="In Use">In Use</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Register Die</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              {diesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Loading tooling library...</p>
                  </TableCell>
                </TableRow>
              ) : dies?.map((die) => (
                <TableRow key={die.id}>
                  <TableCell className="font-bold">{die.name}</TableCell>
                  <TableCell>{die.dimensions}</TableCell>
                  <TableCell>{die.shape}</TableCell>
                  <TableCell>{die.labelsAcross}</TableCell>
                  <TableCell>{die.usageCount?.toLocaleString() || 0} m</TableCell>
                  <TableCell>
                    <Badge className={
                      die.status === 'Available' ? 'bg-emerald-500' : 
                      die.status === 'Maintenance' ? 'bg-amber-500' : 
                      die.status === 'In Use' ? 'bg-primary' : 'bg-destructive'
                    }>
                      {die.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <History className="h-3 w-3 mr-1" /> Life
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!dies || dies.length === 0) && !diesLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Wrench className="h-8 w-8 opacity-20" />
                      <p>No dies found in library. Add one to begin tracking.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
