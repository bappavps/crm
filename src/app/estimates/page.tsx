
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Search, 
  Plus, 
  Loader2, 
  Eye, 
  Trash2, 
  FilterX, 
  ArrowUpDown, 
  ArrowRightLeft,
  Calendar,
  ClipboardType,
  CheckCircle2,
  Clock,
  ArrowRight
} from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, query, orderBy, where, doc, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export default function EstimatesRegistryPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  // Data Fetching
  const estimatesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    let base = collection(firestore, 'estimates');
    return query(base, orderBy('createdAt', 'desc'));
  }, [firestore, user]);

  const { data: allEstimates, isLoading } = useCollection(estimatesQuery);

  const filteredEstimates = useMemo(() => {
    if (!allEstimates) return [];
    
    let result = allEstimates;

    // Security Filter: Sales see own, Admin sees all
    if (!isAdmin && user) {
      result = result.filter(e => e.createdById === user.uid);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.estimateNumber?.toLowerCase().includes(q) || 
        e.customerName?.toLowerCase().includes(q) || 
        e.productCode?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(e => e.status === statusFilter);
    }

    return result;
  }, [allEstimates, searchQuery, statusFilter, isAdmin, user]);

  const stats = useMemo(() => {
    if (!filteredEstimates) return { total: 0, approved: 0, converted: 0 };
    return {
      total: filteredEstimates.length,
      approved: filteredEstimates.filter(e => e.status === 'Approved').length,
      converted: filteredEstimates.filter(e => e.status === 'Converted').length
    };
  }, [filteredEstimates]);

  const handleDelete = async (id: string, num: string) => {
    if (!firestore || !isAdmin) return;
    if (confirm(`Delete estimate ${num}? This action is permanent.`)) {
      try {
        await deleteDoc(doc(firestore, 'estimates', id));
        toast({ title: "Estimate Deleted", description: "Record removed from registry." });
      } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete record." });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Estimate Pipeline</h2>
          <p className="text-muted-foreground font-medium">Lifecycle management from draft calculation to confirmed orders.</p>
        </div>
        <Button asChild className="shadow-lg h-12 px-6 font-bold uppercase tracking-widest">
          <Link href="/estimate"><Plus className="mr-2 h-5 w-5" /> New Calculation</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Active Pipeline</span>
            <span className="text-3xl font-black text-primary">{stats.total}</span>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Approved & Ready</span>
            <span className="text-3xl font-black text-emerald-600">{stats.approved}</span>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Converted to Orders</span>
            <span className="text-3xl font-black text-blue-600">{stats.converted}</span>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl">
        <CardHeader className="pb-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardType className="h-5 w-5 text-primary" /> Estimate Registry
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search client, EST#, product..." 
                  className="pl-8 bg-muted/20 border-none" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="h-10 rounded-md bg-muted/20 border-none px-3 text-xs font-bold uppercase"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Approved">Approved</option>
                <option value="Converted">Converted</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 px-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase pl-6">EST #</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Client</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Product Code</TableHead>
                <TableHead className="font-black text-[10px] uppercase text-center">Qty</TableHead>
                <TableHead className="font-black text-[10px] uppercase text-right">Value (₹)</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Status</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Created</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredEstimates.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/10 transition-colors group">
                  <TableCell className="font-black text-primary font-mono text-xs pl-6">{e.estimateNumber}</TableCell>
                  <TableCell className="font-bold text-sm">{e.customerName}</TableCell>
                  <TableCell className="text-[11px] font-mono text-muted-foreground">{e.productCode}</TableCell>
                  <TableCell className="text-center font-bold">{e.orderQuantity?.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-black text-accent">₹{e.totalSellingPrice?.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "text-[9px] font-black h-5 px-2",
                      e.status === 'Draft' && "bg-slate-500",
                      e.status === 'Sent' && "bg-blue-500",
                      e.status === 'Approved' && "bg-emerald-500",
                      e.status === 'Converted' && "bg-primary",
                      e.status === 'Cancelled' && "bg-destructive"
                    )}>
                      {e.status?.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground font-medium">
                    {e.createdAt?.toDate ? format(e.createdAt.toDate(), 'dd MMM yyyy') : '-'}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild title="View Breakdown">
                        <Link href={`/estimates/${e.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(e.id, e.estimateNumber)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" asChild title="Convert">
                        <Link href={`/estimates/${e.id}`}><ArrowRight className="h-4 w-4 text-primary" /></Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEstimates.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-20 text-muted-foreground italic text-sm">
                    No matching estimates found in pipeline.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
