
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Box, Loader2, PackageSearch, FileText } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function FinishedGoodsPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Query
  const fgQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'inventoryItems');
  }, [firestore, user, adminData])

  const { data: inventory, isLoading } = useCollection(fgQuery)

  const finishedGoods = inventory?.filter(item => item.itemType === 'Finished Good') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Finished Goods Inventory</h2>
          <p className="text-muted-foreground">Track printed and packed labels ready for customer delivery.</p>
        </div>
        <Button variant="outline" onClick={() => toast({ title: "Inventory Report", description: "Generating FG summary..." })}>
          <FileText className="mr-2 h-4 w-4" /> Export Stock
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" /> FG Stock Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Quantity (Labels)</TableHead>
                <TableHead>Batch Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : finishedGoods.map((fg) => (
                <TableRow key={fg.id}>
                  <TableCell className="font-bold">{fg.barcode}</TableCell>
                  <TableCell className="text-sm">{fg.name}</TableCell>
                  <TableCell className="font-mono font-bold text-accent">{fg.currentQuantity?.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(fg.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{fg.location}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-emerald-500">QC Passed</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {finishedGoods.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <PackageSearch className="h-10 w-10 opacity-20" />
                      <p>No finished goods found in stock.</p>
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
