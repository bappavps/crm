
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Eye, Loader2, ShieldCheck } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, runTransaction } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function AdminApprovalPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !adminData) return null;
    return collection(firestore, 'jobs');
  }, [firestore, adminData])

  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery)
  const pendingJobs = jobs?.filter(j => j.status === 'Pending Approval') || []

  const handleApprove = async (jobId: string) => {
    if (!firestore || !user) return
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const masterRef = doc(firestore, 'jobs', jobId);
        const techRef = doc(firestore, `jobs/${jobId}/technical/details`);
        
        const now = new Date();
        // Technical lock starts 30 mins after approval
        const lockTime = new Date(now.getTime() + 30 * 60000).toISOString();

        transaction.update(masterRef, {
          status: 'Approved',
          adminApproved: true,
          approvedAt: now.toISOString(),
          approvedBy: user.uid,
          currentStage: 'Planning'
        });

        // Initialize technical doc with lock if it doesn't exist, otherwise update lock
        transaction.set(techRef, {
          edit_lock_time: lockTime,
          approval_timestamp: now.toISOString()
        }, { merge: true });
      });

      toast({ title: "Job Approved", description: "Master status updated and technical lock set to 30 mins." })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Approval Failed", description: e.message })
    }
  }

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
  if (!adminData) return <div className="p-20 text-center text-muted-foreground">Access Restricted to Administrators.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Job Approval Queue (V2)</h2>
          <p className="text-muted-foreground">Modular approval flow initializes technical time-locks.</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-bold text-lg">{pendingJobs.length} PENDING</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Approval Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-black text-primary">{job.jobNumber}</TableCell>
                  <TableCell className="font-bold">{job.clientName}</TableCell>
                  <TableCell className="text-xs">{job.itemNameSummary}</TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleApprove(job.id)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                    </Button>
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
