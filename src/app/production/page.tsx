
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Factory, Play, Pause, AlertTriangle } from "lucide-react"

const productionLines = [
  { id: 'MC-01', name: 'UV Flexo 8-Color', currentJob: 'JC-4501', speed: '65 m/min', output: '32,500 / 50,000', efficiency: 88, status: 'Running' },
  { id: 'MC-02', name: 'Water-Based Flexo', currentJob: 'JC-4503', speed: '40 m/min', output: '3,000 / 20,000', efficiency: 72, status: 'Running' },
  { id: 'MC-03', name: 'Digital Label Press', currentJob: 'Idle', speed: '0 m/min', output: '-', efficiency: 0, status: 'Stopped' },
]

export default function ProductionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Live Production Floor</h2>
          <p className="text-muted-foreground">Real-time machine monitoring and output tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-destructive"><AlertTriangle className="mr-2 h-4 w-4" /> Report Issue</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {productionLines.map((line) => (
          <Card key={line.id} className={`border-l-4 ${line.status === 'Running' ? 'border-l-emerald-500' : 'border-l-muted'}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Factory className="h-5 w-5 text-primary" /> {line.name}
                </CardTitle>
                <Badge variant={line.status === 'Running' ? 'default' : 'secondary'} className={line.status === 'Running' ? 'bg-emerald-500' : ''}>
                  {line.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-bold">Current Job</p>
                  <p className="font-bold text-primary">{line.currentJob}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs uppercase font-bold">Current Speed</p>
                  <p className="font-bold">{line.speed}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Production Progress</span>
                  <span>{line.efficiency > 0 ? `${line.efficiency}% Efficiency` : '0%'}</span>
                </div>
                <Progress value={line.efficiency} className="h-2" />
                <p className="text-[10px] text-muted-foreground mt-1">Output: {line.output}</p>
              </div>

              <div className="flex gap-2 pt-2">
                {line.status === 'Running' ? (
                  <Button variant="outline" size="sm" className="flex-1"><Pause className="mr-2 h-3 w-3" /> Pause</Button>
                ) : (
                  <Button size="sm" className="flex-1"><Play className="mr-2 h-3 w-3" /> Start Shift</Button>
                )}
                <Button variant="ghost" size="sm" className="flex-1">Logs</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
