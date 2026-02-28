
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  Trash2, 
  RefreshCw,
  ShieldAlert
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog"
import { useFirestore, useUser, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase"
import { 
  collection, 
  doc, 
  runTransaction, 
  query, 
  where, 
  limit, 
  getDocs, 
  writeBatch,
  setDoc,
  serverTimestamp
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

/**
 * PRODUCTION MIGRATION & RESET UTILITY (V2)
 * Handles both Master-Subcollection restructuring and development data wipes.
 */
export default function MigrationPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Authorization Check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

  /**
   * REFACTORING: Move legacy fields to sub-collections
   */
  const runMigration = async () => {
    if (!firestore || !adminData) return
    setIsProcessing(true)
    addLog("Starting migration scan...")

    const jobsQuery = query(
      collection(firestore, 'jobs'),
      where("migrated_v2", "!=", true),
      limit(20)
    )
    
    getDocs(jobsQuery).then(async (snapshot) => {
      if (snapshot.empty) {
        addLog("All jobs are already on V2 architecture.")
        setIsProcessing(false)
        return
      }

      const total = snapshot.size
      let count = 0

      for (const jobDoc of snapshot.docs) {
        const jobData = jobDoc.data()
        const jobId = jobDoc.id

        await runTransaction(firestore, async (transaction) => {
          const techRef = doc(firestore, `jobs/${jobId}/technical/details`)
          const finRef = doc(firestore, `jobs/${jobId}/financial/summary`)
          const masterRef = doc(firestore, 'jobs', jobId)

          const techData = {
            items: jobData.items || [],
            plateNo: jobData.plateNo || "",
            repeat_length: jobData.repeat_length || 0,
            paper_width: jobData.paper_width || 0,
            material: jobData.material || "",
            edit_lock_time: jobData.edit_lock_time || new Date().toISOString(),
            migrated_from_v1: true
          }

          const finData = {
            totalJobValue: jobData.totalJobValue || 0,
            sqInchDivider: jobData.sqInchDivider || 625,
            itemPricing: jobData.itemPricing || [],
            migrated_from_v1: true
          }

          transaction.set(techRef, techData)
          transaction.set(finRef, finData)
          
          transaction.update(masterRef, {
            migrated_v2: true,
            items: null,
            artworkUrl: null,
            totalJobValue: null,
            updatedAt: serverTimestamp()
          })
        }).catch((err) => {
          throw err;
        })

        count++
        setProgress(Math.round((count / total) * 100))
        addLog(`Migrated Job: ${jobData.jobNumber || jobId}`)
      }

      addLog(`Success! Processed ${count} records.`)
      toast({ title: "Migration Complete", description: `Restructured ${count} jobs.` })
      setIsProcessing(false)
    }).catch(async (serverError) => {
      setIsProcessing(false)
      addLog(`FATAL ERROR: ${serverError.message}`)
      const permissionError = new FirestorePermissionError({
        path: 'jobs',
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
    })
  }

  /**
   * EMERGENCY RESET: Wipe all transactional data
   */
  const runFullReset = async () => {
    if (!firestore || !adminData) return
    setIsProcessing(true)
    setProgress(0)
    setLog([])
    addLog("--- INITIATING FULL TRANSACTIONAL WIPE ---")

    const collectionsToWipe = [
      'jobs',
      'salesOrders',
      'estimates',
      'customers',
      'jumbo_stock',
      'inventoryItems',
      'job_audit_log',
      'qualityChecks',
      'jobCards',
      'workOrders',
      'notifications'
    ]

    try {
      // 1. Wipe Collections in Batches
      for (const colName of collectionsToWipe) {
        addLog(`Wiping collection: ${colName}...`)
        const q = query(collection(firestore, colName))
        const snapshot = await getDocs(q).catch((e) => { throw e; })
        
        if (snapshot.empty) {
          addLog(`Collection ${colName} is already empty.`);
          continue;
        }

        const batches = []
        let currentBatch = writeBatch(firestore)
        let count = 0

        for (const d of snapshot.docs) {
          currentBatch.delete(d.ref)
          count++
          
          if (count === 50) {
            batches.push(currentBatch.commit())
            currentBatch = writeBatch(firestore)
            count = 0
          }
        }
        
        if (count > 0) batches.push(currentBatch.commit())
        await Promise.all(batches)
        addLog(`Successfully wiped ${snapshot.size} docs from ${colName}.`)
      }

      // 2. Reset Counters
      addLog("Resetting atomic sequences...")
      const counters = ['job_counter', 'jumbo_roll', 'job_id']
      for (const c of counters) {
        await setDoc(doc(firestore, 'counters', c), {
          current_number: 0,
          year: new Date().getFullYear().toString(),
          resetAt: serverTimestamp()
        }, { merge: true })
        addLog(`Counter [${c}] reset to zero.`)
      }

      addLog("--- WIPE COMPLETE ---")
      toast({ title: "Database Reset", description: "Transactional data has been cleared." })
    } catch (error: any) {
      addLog(`WIPE ERROR: ${error.message}`)
      const permissionError = new FirestorePermissionError({
        path: 'multiple',
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsProcessing(false)
      setIsWipeConfirmOpen(false)
    }
  }

  if (!isMounted) return <div className="flex h-[calc(100vh-10rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!adminData) return <div className="p-20 text-center text-muted-foreground">Unauthorized Access. Admin Role Required.</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Database Maintenance Suite</h2>
          <p className="text-muted-foreground">Admin-only tools for restructuring and environment resets.</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-bold text-lg">ADMIN CONSOLE</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* MIGRATION CARD */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" /> Schema Migration (V2)
              </CardTitle>
              <CardDescription>
                Restructure heavy "Jobs" documents into modular sub-collections for scaling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-bold">Architecture V2 Benefits</p>
                  <p>Isolates Technical vs Financial data. Prevents 1MB doc limits. Enhances security rules.</p>
                </div>
              </div>
              <Button 
                onClick={runMigration} 
                disabled={isProcessing} 
                className="w-full h-12 font-bold"
                variant="outline"
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <History className="mr-2 h-5 w-5" />}
                Run Technical Refactor
              </Button>
            </CardContent>
          </Card>

          {/* DANGER ZONE RESET CARD */}
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" /> Danger Zone: Full Wipe
              </CardTitle>
              <CardDescription className="text-destructive/70">
                Permanently delete all Jobs, Orders, Inventory, and Logs. Resets atomic counters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={isWipeConfirmOpen} onOpenChange={setIsWipeConfirmOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full h-12 font-bold" disabled={isProcessing}>
                    <Trash2 className="mr-2 h-4 w-4" /> Reset Transactional Database
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-6 w-6" /> Destructive Action Confirmation
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="pt-4 space-y-3">
                        <p className="font-bold text-foreground">Are you absolutely sure you want to wipe the database?</p>
                        <ul className="list-disc pl-5 text-xs space-y-1">
                          <li>All <strong>Jobs</strong> and <strong>Orders</strong> will be deleted.</li>
                          <li>All <strong>Jumbo Stock</strong> and <strong>Inventory</strong> will be cleared.</li>
                          <li><strong>Counters</strong> will reset to sequence #1.</li>
                          <li><span className="text-emerald-600 font-bold">Safe:</span> Users and System Settings will be preserved.</li>
                        </ul>
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => setIsWipeConfirmOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={runFullReset} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="animate-spin mr-2" /> : "Yes, Wipe All Data"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* LOG CONSOLE */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Process Log
              {isProcessing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[400px]">
            <div className="h-full overflow-y-auto bg-black rounded-md p-3 font-mono text-[10px] space-y-1 border border-primary/20 text-emerald-500 shadow-inner">
              {log.map((entry, i) => (
                <p key={i} className={entry.includes("ERROR") ? "text-red-400" : entry.includes("WIPE") ? "text-amber-400" : ""}>
                  {entry}
                </p>
              ))}
              {log.length === 0 && <p className="text-muted-foreground italic text-center py-40 opacity-30">Waiting for process start...</p>}
            </div>
            {isProcessing && (
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-primary">
                  <span>PROCESSING</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1 bg-muted" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
