
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Users, Database, Box } from "lucide-react"

export default function MasterDataPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Master Data Management</h2>
          <p className="text-muted-foreground">Configure global constants, machines, and material types.</p>
        </div>
      </div>

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="materials" className="flex items-center gap-2"><Database className="h-4 w-4" /> Materials</TabsTrigger>
          <TabsTrigger value="machines" className="flex items-center gap-2"><Box className="h-4 w-4" /> Machines</TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2"><Users className="h-4 w-4" /> Clients</TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2"><Settings className="h-4 w-4" /> App Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="materials" className="pt-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Material Master</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Select a category to manage individual items.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
