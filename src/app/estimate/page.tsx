
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { calculateFlexoLayout, EstimateInputs } from "@/lib/flexo-utils"
import { Save, Printer, Calculator as CalcIcon, FilePlus } from "lucide-react"

export default function EstimatePage() {
  const { toast } = useToast()
  const [inputs, setInputs] = useState<EstimateInputs>({
    labelLength: 50,
    labelWidth: 100,
    gap: 3,
    sideMargin: 5,
    repeatLength: 508,
    printingWidthLimit: 250,
    jumboWidth: 1020,
    orderQuantity: 10000,
    materialRate: 25,
    printingRate: 1.5,
    uvRate: 0.5,
    machineCostPerHour: 1500,
    laborCostPerHour: 500,
    machineSpeed: 60,
    wastagePercent: 5
  })

  const results = useMemo(() => calculateFlexoLayout(inputs), [inputs])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setInputs(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const handleSave = () => {
    toast({
      title: "Estimate Saved",
      description: `Estimate for ${inputs.orderQuantity} labels has been stored.`,
    })
  }

  const handlePrint = () => {
    toast({
      title: "Generating PDF",
      description: "Quotation is being prepared for printing.",
    })
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Estimate Module</h2>
          <p className="text-muted-foreground">Narrow Web Flexo Layout & Costing Calculator</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print PDF</Button>
          <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Save Estimate</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalcIcon className="h-5 w-5 text-primary" /> Job Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="labelLength">Label Length (mm)</Label>
                  <Input id="labelLength" name="labelLength" type="number" value={inputs.labelLength} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="labelWidth">Label Width (mm)</Label>
                  <Input id="labelWidth" name="labelWidth" type="number" value={inputs.labelWidth} onChange={handleInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gap">Gap (mm)</Label>
                  <Input id="gap" name="gap" type="number" value={inputs.gap} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sideMargin">Side Margin (mm)</Label>
                  <Input id="sideMargin" name="sideMargin" type="number" value={inputs.sideMargin} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderQuantity">Order Quantity</Label>
                <Select 
                  value={inputs.orderQuantity.toString()} 
                  onValueChange={(val) => setInputs(p => ({...p, orderQuantity: parseInt(val)}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Qty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10000">10,000</SelectItem>
                    <SelectItem value="20000">20,000</SelectItem>
                    <SelectItem value="50000">50,000</SelectItem>
                    <SelectItem value="100000">100,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Machine Constraints</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Repeat (mm)</Label>
                    <Input name="repeatLength" type="number" value={inputs.repeatLength} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Max Width (mm)</Label>
                    <Input name="printingWidthLimit" type="number" value={inputs.printingWidthLimit} onChange={handleInputChange} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg">Commercials</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="materialRate">Material Rate (₹/sqm)</Label>
                <Input id="materialRate" name="materialRate" type="number" value={inputs.materialRate} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="printingRate">Print Rate (₹/m)</Label>
                  <Input id="printingRate" name="printingRate" type="number" value={inputs.printingRate} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uvRate">UV Rate (₹/m)</Label>
                  <Input id="uvRate" name="uvRate" type="number" value={inputs.uvRate} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="machineSpeed">Speed (m/min)</Label>
                <Input id="machineSpeed" name="machineSpeed" type="number" value={inputs.machineSpeed} onChange={handleInputChange} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-primary/20 bg-primary/5 shadow-inner">
              <CardHeader>
                <CardTitle className="text-primary flex items-center justify-between">
                  Layout Calculation
                  <Badge variant="outline" className="font-bold border-primary text-primary">AUTO</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
                <div className="text-muted-foreground">Labels Across:</div>
                <div className="font-bold text-right">{results.labelAcross}</div>
                <div className="text-muted-foreground">Labels Around:</div>
                <div className="font-bold text-right">{results.labelAround}</div>
                <div className="text-muted-foreground">Labels per Repeat:</div>
                <div className="font-bold text-right">{results.labelsPerRepeat}</div>
                <Separator className="col-span-2" />
                <div className="text-muted-foreground">Total Repeats:</div>
                <div className="font-bold text-right">{results.totalRepeats}</div>
                <div className="text-muted-foreground">Running Meter:</div>
                <div className="font-bold text-right text-accent">{results.runningMeter.toFixed(2)} m</div>
                <div className="text-muted-foreground">Slitting Size:</div>
                <div className="font-bold text-right">{results.slittingSize} mm</div>
                <div className="text-muted-foreground">Rolls from Jumbo:</div>
                <div className="font-bold text-right">{results.rollsFromJumbo}</div>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-accent/5 shadow-inner">
              <CardHeader>
                <CardTitle className="text-accent">Costing Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
                <div className="text-muted-foreground">Material Cost:</div>
                <div className="font-bold text-right">₹{results.materialCost.toFixed(2)}</div>
                <div className="text-muted-foreground">Printing Cost:</div>
                <div className="font-bold text-right">₹{results.printingCost.toFixed(2)}</div>
                <div className="text-muted-foreground">UV Cost:</div>
                <div className="font-bold text-right">₹{results.uvCost.toFixed(2)}</div>
                <div className="text-muted-foreground">Production Overhead:</div>
                <div className="font-bold text-right">₹{(results.machineCostTotal + results.laborCostTotal).toFixed(2)}</div>
                <Separator className="col-span-2" />
                <div className="text-lg font-bold text-accent">Total Cost:</div>
                <div className="text-lg font-bold text-right text-accent">₹{results.totalCost.toFixed(2)}</div>
                <div className="text-muted-foreground">Cost per Label:</div>
                <div className="font-bold text-right">₹{results.costPerLabel.toFixed(4)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary shadow-lg overflow-hidden">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="flex items-center justify-between">
                <span>Final Quotation Summary</span>
                <Badge className="bg-white text-primary hover:bg-white/90">ORDER QTY: {inputs.orderQuantity.toLocaleString()}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 flex flex-col items-center justify-center space-y-6">
              <div className="grid grid-cols-3 gap-12 w-full text-center">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Selling Price / Label</p>
                  <p className="text-4xl font-black text-primary">₹{results.sellingPricePerLabel.toFixed(3)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Total Selling Price</p>
                  <p className="text-4xl font-black text-foreground">₹{results.totalSellingPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Estimated Profit</p>
                  <p className="text-4xl font-black text-emerald-600">₹{results.profit.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                </div>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-primary" 
                  style={{ width: `${100 - results.profitPercent}%` }}
                />
                <div 
                  className="h-full bg-emerald-500" 
                  style={{ width: `${results.profitPercent}%` }}
                />
              </div>
              <div className="flex justify-between w-full text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                <span>Total Expenses ({(100 - results.profitPercent).toFixed(1)}%)</span>
                <span>Net Profit Margin ({results.profitPercent.toFixed(1)}%)</span>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 border-t p-4 flex justify-between">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toast({title: "BOM Created", description: "BOM-2024-X initiated."})}><FilePlus className="mr-2 h-4 w-4" /> Convert to BOM</Button>
                <Button size="sm" variant="outline" onClick={() => toast({title: "Order Converted", description: "SO-900X generated."})}>Create Sales Order</Button>
              </div>
              <p className="text-xs italic text-muted-foreground">*Calculated based on {inputs.machineSpeed}m/min run speed with {inputs.wastagePercent}% wastage.</p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
