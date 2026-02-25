
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, FileText, Download, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export default function ReportsPage() {
  const { toast } = useToast()

  const handleDownload = (reportName: string) => {
    toast({
      title: "Generating Report",
      description: `${reportName} is being compiled and will download shortly.`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Business Reports</h2>
          <p className="text-muted-foreground">Analytical insights into production, sales, and wastage.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:bg-primary/5 cursor-pointer transition-colors border-dashed border-2 group">
          <CardContent className="pt-6 text-center space-y-2">
            <TrendingUp className="h-10 w-10 text-primary mx-auto mb-2 transition-transform group-hover:scale-110" />
            <h3 className="font-bold">Production Efficiency</h3>
            <p className="text-xs text-muted-foreground">Analyze machine uptime and operator performance.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => handleDownload("Production Efficiency Report")}
            >
              <Download className="h-3 w-3 mr-2" /> Download PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:bg-primary/5 cursor-pointer transition-colors border-dashed border-2 group">
          <CardContent className="pt-6 text-center space-y-2">
            <FileText className="h-10 w-10 text-primary mx-auto mb-2 transition-transform group-hover:scale-110" />
            <h3 className="font-bold">Wastage Analytics</h3>
            <p className="text-xs text-muted-foreground">Detailed breakdown of material wastage per job.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => handleDownload("Wastage Analytics Report")}
            >
              <Download className="h-3 w-3 mr-2" /> Download PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:bg-primary/5 cursor-pointer transition-colors border-dashed border-2 group">
          <CardContent className="pt-6 text-center space-y-2">
            <BarChart className="h-10 w-10 text-primary mx-auto mb-2 transition-transform group-hover:scale-110" />
            <h3 className="font-bold">Sales Analysis</h3>
            <p className="text-xs text-muted-foreground">Revenue trends and client-wise profitability.</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => handleDownload("Sales Analysis Report")}
            >
              <Download className="h-3 w-3 mr-2" /> Download PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
