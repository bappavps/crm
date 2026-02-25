
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FilePlus, Play, CheckCircle2 } from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"

export default function JobCardPage() {
  const firestore = useFirestore()
  const jobCardsQuery = useMemoFirebase(() => collection(firestore!, 'jobCards'), [firestore])
  const { data: jobCards, isLoading } = useCollection(jobCardsQuery)

  // Static fallback for prototype look
  const staticJobs = [
    { id: 'JC-4501', client: 'PharmaTech India', label: 'Cough Syrup 100ml', machine: 'UV-FLEXO 01', qty: '50,000', status: 'Running', progress: 65 },
    { id: 'JC-4498', client: 'AgriCorp', label: 'Pesticide Danger', machine: 'UV-FLEXO 01', qty: '15,000', status: 'Completed', progress: 100 },
  ]

  const displayJobs = jobCards && jobCards.length > 0 ? jobCards : staticJobs

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Job Cards</h2>
          <p className="text-muted-foreground">Manage production floor jobs and real-time status.</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary hover:bg-primary/90"><FilePlus className="mr-2 h-4 w-4" /> Create New Job</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayJobs.map((job: any) => (
          <Card key={job.id} className="relative overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-mono font-bold text-muted-foreground">{job.id || job.jobCardNumber}</span>
                <Badge className={
                  job.status === 'Running' ? 'bg-emerald-500' : 
                  job.status === 'Pending' ? 'bg-amber-500' : 
                  job.status === 'Setup' ? 'bg-primary' : 'bg-slate-500'
                }>{job.status}</Badge>
              </div>
              <CardTitle className="text-lg pt-1">{job.label || 'New Label Job'}</CardTitle>
              <p className="text-xs font-semibold text-primary">{job.client || 'Internal Customer'}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-muted-foreground">Machine:</div>
                <div className="font-bold text-right">{job.machine || 'TBD'}</div>
                <div className="text-muted-foreground">Quantity:</div>
                <div className="font-bold text-right">{job.qty || job.productionQuantity}</div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span>Progress</span>
                  <span>{job.progress || 0}%</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${job.progress || 0}%` }}
                  />
                </div>
              </div>
              
              <div className="pt-2">
                {job.status === 'Running' ? (
                  <Button variant="outline" size="sm" className="w-full text-accent border-accent hover:bg-accent hover:text-white">Pause Job</Button>
                ) : job.status === 'Completed' ? (
                  <Button variant="ghost" size="sm" className="w-full text-emerald-600 font-bold"><CheckCircle2 className="mr-2 h-3 w-3" /> View Quality Report</Button>
                ) : (
                  <Button size="sm" className="w-full"><Play className="mr-2 h-3 w-3" /> Start Job</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
