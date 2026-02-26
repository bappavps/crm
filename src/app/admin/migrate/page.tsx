
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Loader2, Database, AlertTriangle, CheckCircle2, History } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, runTransaction, query, where, limit, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

/**
 * PRODUCTION MIGRATION UTILITY (V2)
 * Refactors heavy job documents into Master-Subcollection structure.
 */
export default function MigrationPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMigrating, setIsMigrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string[]>([])

  // Authorization Check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

  const runMigration = async () => {
    if (!firestore || !adminData) return
    setIsMigrating(true)
    addLog("Starting migration scan...")

    try {
      // 1. Find jobs that haven't been migrated
      const jobsQuery = query(
        collection(firestore, 'jobs'),
        where("migrated_v2", "!=", true),
        limit(20) // Process in small batches for safety
      )
      
      const snapshot = await getDocs(jobsQuery)
      if (snapshot.empty) {
        addLog("All jobs are already on V2 architecture.")
        setIsMigrating(false)
        return
      }

      const total = snapshot.size
      let count = 0

      for (const jobDoc of snapshot.docs) {
        const jobData = jobDoc.data()
        const jobId = jobDoc.id

        await runTransaction(firestore, async (transaction) => {
          // Sub-doc references
          const techRef = doc(firestore, `jobs/${jobId}/technical/details`)
          const finRef = doc(firestore, `jobs/${jobId}/financial/summary`)
          const masterRef = doc(firestore, 'jobs', jobId)

          // 1. Technical Migration
          const techData = {
            items: jobData.items || [],
            plateNo: jobData.plateNo || "",
            repeat_length: jobData.repeat_length || 0,
            paper_width: jobData.paper_width || 0,
            material: jobData.material || "",
            edit_lock_time: jobData.edit_lock_time || new Date().toISOString(),
            migrated_from_v1: true
          }

          // 2. Financial Migration
          const finData = {
            totalJobValue: jobData.totalJobValue || 0,
            sqInchDivider: jobData.sqInchDivider || 625,
            itemPricing: jobData.itemPricing || [],
            migrated_from_v1: true
          }

          // 3. File Migration (if artwork exists)
          if (jobData.artworkUrl) {
            const fileRef = doc(collection(firestore, `jobs/${jobId}/files`))
            transaction.set(fileRef, {
              fileType: 'artwork',
              fileName: 'Migrated Legacy Artwork',
              fileUrl: jobData.artworkUrl,
              uploadedAt: jobData.createdAt || new Date().toISOString()
            })
          }

          // 4. Atomic Updates
          transaction.set(techRef, techData)
          transaction.set(finRef, finData)
          
          // 5. Clean Master Document
          transaction.update(masterRef, {
            migrated_v2: true,
            items: null, // Remove heavy array
            artworkUrl: null,
            totalJobValue: null,
            updatedAt: new Date().toISOString()
          })
        })

        count++
        setProgress(Math.round((count / total) * 100))
        addLog(`Migrated Job: ${jobData.jobNumber || jobId}`)
      }

      addLog(`Success! Processed ${count} records.`)
      toast({ title: "Migration Complete", description: `Restructured ${count} jobs.` })
    } catch (error: any) {
      addLog(`FATAL ERROR: ${error.message}`)
      toast({ variant: "destructive", title: "Migration Failed", description: error.message })
    } finally {
      setIsMigrating(false)
    }
  }

  if (!adminData) return <div className="p-20 text-center text-muted-foreground">Unauthorized Access.</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Database Restructuring Tool</h2>
          <p className="text-muted-foreground">Migrating heavy "Jobs" documents to Master-Subcollection V2.</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-bold text-lg">ARCHITECTURE V2</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" /> Migration Console
            </CardTitle>
            <CardDescription>
              This utility Extracts Technical and Financial data from the master "jobs" document 
              and moves it into optimized sub-collections.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 space-y-1">
                <p className="font-bold uppercase">Production Warning</p>
                <p>Ensure you have performed a Firestore backup. This process deletes the "items" array from the master document once moved.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                <span>Atomic Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Button 
              onClick={runMigration} 
              disabled={isMigrating} 
              className="w-full h-12 text-lg font-bold"
            >
              {isMigrating ? <Loader2 className="animate-spin mr-2" /> : <History className="mr-2 h-5 w-5" />}
              Execute Transactional Migration
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Process Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] overflow-y-auto bg-muted/30 rounded-md p-3 font-mono text-[10px] space-y-1 border">
              {log.map((entry, i) => (
                <p key={i} className={entry.includes("ERROR") ? "text-destructive" : ""}>{entry}</p>
              ))}
              {log.length === 0 && <p className="text-muted-foreground italic text-center py-20">No active process log.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg bg-card text-center space-y-1">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Data Integrity</p>
          <p className="text-xs font-medium">Atomic Transactions</p>
        </div>
        <div className="p-4 border rounded-lg bg-card text-center space-y-1">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Idempotency</p>
          <p className="text-xs font-medium">Safe Re-runs</p>
        </div>
        <div className="p-4 border rounded-lg bg-card text-center space-y-1">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Capacity</p>
          <p className="text-xs font-medium">Batch Processing</p>
        </div>
      </div>
    </div>
  )
}
