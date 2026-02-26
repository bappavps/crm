
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Eye, Loader2, ShieldCheck, User, Calendar, Receipt } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, updateDoc } from "firebase/firestore"
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

export default function AdminApprovalPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Authorization Check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, '_system_roles/admins', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  // Query pending jobs
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !adminData) return null;
    return collection(firestore, 'jobs');
  }, [firestore, adminData])

  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery)
  const pendingJobs = jobs?.filter(j => j.status === 'Pending Approval') || []

  const handleApprove = (jobId: string) => {
    if (!firestore || !user) return
    
    updateDocumentNonBlocking(doc(firestore, 'jobs', jobId), {
      status: 'Approved',
      adminApproved: true,
      approvedAt: new Date().toISOString(),
      approvedBy: user.uid
    })

    setIsPreviewOpen(false)
    toast({
      title: "Job Approved",
      description: "Sales job has been released for production planning."
    })
  }

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
  if (!adminData) return <div className="p-20 text-center text-muted-foreground">Access Restricted to Administrators.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Sales Job Approvals</h2>
          <p className="text-muted-foreground">Verify pricing and technical specs before releasing to production.</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-bold text-lg">{pendingJobs.length} PENDING</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Approval Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : pendingJobs.map((job) => {
                const totalValue = job.items?.reduce((acc: number, i: any) => acc + (i.totalJobValue || 0), 0)
                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-black text-primary">{job.jobNumber}</TableCell>
                    <TableCell className="font-bold">{job.clientName}</TableCell>
                    <TableCell className="text-xs">{job.salesUserName}</TableCell>
                    <TableCell className="text-xs">{new Date(job.jobDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-bold text-accent">₹{totalValue?.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedJob(job); setIsPreviewOpen(true); }}>
                        <Eye className="mr-2 h-4 w-4" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {pendingJobs.length === 0 && !jobsLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No jobs currently awaiting approval.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center pr-6">
              <DialogTitle className="text-2xl font-black text-primary">{selectedJob?.jobNumber}</DialogTitle>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">{selectedJob?.jobType} Job</Badge>
            </div>
            <DialogDescription>Reviewing Sales Submission for {selectedJob?.clientName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Sales Rep</Label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">{selectedJob?.salesUserName}</span>
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Submission Date</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">{selectedJob?.jobDate ? new Date(selectedJob.jobDate).toLocaleDateString() : '-'}</span>
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Label className="text-[10px] uppercase text-primary font-bold">Total Estimated Value</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Receipt className="h-4 w-4 text-primary" />
                  <span className="text-lg font-black text-primary">₹{selectedJob?.items?.reduce((acc: number, i: any) => acc + (i.totalJobValue || 0), 0)?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-black text-sm uppercase tracking-widest text-muted-foreground">Itemized Breakdown</h4>
              {selectedJob?.items?.map((item: any, idx: number) => (
                <div key={idx} className="border rounded-xl overflow-hidden bg-background shadow-sm">
                  <div className="flex">
                    <div className="w-32 h-32 relative bg-muted shrink-0 border-r">
                      <Image src={item.artworkUrl} alt="art" fill className="object-cover" />
                    </div>
                    <div className="flex-1 p-4 grid grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Item Name</Label>
                        <p className="font-bold text-base">{item.itemName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.material} • {item.brand}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Size</Label>
                        <p className="font-mono text-sm">{item.widthMM} x {item.heightMM} mm</p>
                      </div>
                      <div className="text-right">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Quantity</Label>
                        <p className="font-black text-lg">{item.quantity?.toLocaleString()}</p>
                      </div>
                      
                      <div className="col-span-4 grid grid-cols-4 gap-4 mt-2 pt-2 border-t border-dashed">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Price/SqInch</Label>
                          <p className="font-bold">₹{item.pricePerSqInch}</p>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Cost/Label</Label>
                          <p className="font-bold">₹{item.costPerLabel}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <Label className="text-[10px] text-primary font-bold">Line Total</Label>
                          <p className="font-black text-primary">₹{item.totalJobValue?.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive/10" onClick={() => setIsPreviewOpen(false)}>
              <XCircle className="mr-2 h-4 w-4" /> Reject Submission
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(selectedJob.id)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & Release to Production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
