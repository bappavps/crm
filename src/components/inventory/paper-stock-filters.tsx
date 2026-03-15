
"use client"

import * as React from "react"
import { 
  Search, 
  FilterX, 
  ChevronDown,
  Check,
  Building2,
  FileText,
  Hash,
  Activity
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface PaperStockFiltersProps {
  data: any[]
  filters: any
  setFilters: (filters: any) => void
  onReset: () => void
}

/**
 * Modular Advanced Filter Component for Paper Stock / GRN Registry.
 * Features dynamic multi-select dropdowns and technical range searches.
 */
export function PaperStockFilters({ data, filters, setFilters, onReset }: PaperStockFiltersProps) {
  
  // Helper to get unique values for dropdowns
  const getUniqueOptions = (key: string) => {
    if (!data) return []
    return Array.from(new Set(data.map(item => String(item[key] || "")).filter(v => v !== ""))).sort()
  }

  const companies = getUniqueOptions('paperCompany')
  const types = getUniqueOptions('paperType')
  const gsmValues = getUniqueOptions('gsm')
  const statuses = ["Main", "Stock", "Slitting", "Job Assign", "In Production"]

  const toggleMultiSelect = (key: string, value: string) => {
    const current = filters[key] || []
    const next = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value]
    setFilters({ ...filters, [key]: next })
  }

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6 shrink-0 border-slate-200">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* GLOBAL SEARCH & BASIC INPUTS */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400">Global Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search everything..." 
                className="pl-10 h-10 text-xs bg-slate-50 border-slate-200 font-black rounded-xl"
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400">Lot / Batch No</Label>
            <Input 
              placeholder="Enter Lot ID..." 
              className="h-10 text-xs bg-slate-50 border-slate-200 font-black rounded-xl"
              value={filters.lotNoSearch || ""}
              onChange={e => setFilters({ ...filters, lotNoSearch: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400">GRN / Roll No</Label>
            <Input 
              placeholder="Enter Roll ID..." 
              className="h-10 text-xs bg-slate-50 border-slate-200 font-black rounded-xl"
              value={filters.rollNoSearch || ""}
              onChange={e => setFilters({ ...filters, rollNoSearch: e.target.value })}
            />
          </div>
        </div>

        {/* MULTI-SELECT DROPDOWNS */}
        <div className="flex flex-wrap items-end gap-3">
          <FilterPopover 
            label="Company" 
            icon={Building2} 
            options={companies} 
            selected={filters.paperCompany || []} 
            onToggle={(v) => toggleMultiSelect('paperCompany', v)} 
          />
          <FilterPopover 
            label="Paper Type" 
            icon={FileText} 
            options={types} 
            selected={filters.paperType || []} 
            onToggle={(v) => toggleMultiSelect('paperType', v)} 
          />
          <FilterPopover 
            label="GSM" 
            icon={Hash} 
            options={gsmValues} 
            selected={filters.gsm || []} 
            onToggle={(v) => toggleMultiSelect('gsm', v)} 
          />
          <FilterPopover 
            label="Status" 
            icon={Activity} 
            options={statuses} 
            selected={filters.status || []} 
            onToggle={(v) => toggleMultiSelect('status', v)} 
          />
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onReset} 
            className="text-[10px] font-black uppercase text-destructive tracking-widest h-10 px-4 border-2 rounded-xl border-destructive/20 hover:bg-destructive/5"
          >
            <FilterX className="h-4 w-4 mr-1.5" /> Reset Filters
          </Button>
        </div>
      </div>
    </div>
  )
}

function FilterPopover({ label, icon: Icon, options, selected, onToggle }: { 
  label: string, 
  icon: any, 
  options: string[], 
  selected: string[], 
  onToggle: (val: string) => void 
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(
          "h-10 px-4 gap-2 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50",
          selected.length > 0 && "border-primary text-primary bg-primary/5 hover:bg-primary/10"
        )}>
          <Icon className="h-3.5 w-3.5" />
          {label} {selected.length > 0 && `(${selected.length})`}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="start">
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest">{label} Filter</span>
          <span className="text-[9px] font-bold opacity-50">{options.length} options</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 bg-white">
          {options.length === 0 ? (
            <p className="p-4 text-center text-[10px] font-bold text-muted-foreground uppercase">No data found</p>
          ) : options.map(opt => (
            <div 
              key={opt} 
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              onClick={() => onToggle(opt)}
            >
              <Checkbox checked={selected.includes(opt)} />
              <label className="text-xs font-black uppercase text-slate-700 cursor-pointer flex-1 truncate">{opt}</label>
              {selected.includes(opt) && <Check className="h-3 w-3 text-primary" />}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
