"use client"

import * as React from "react"
import { Filter, Search, Check } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ColumnHeaderFilterProps {
  columnKey: string
  label: string
  data: any[]
  selectedValues: string[]
  onFilterChange: (values: string[]) => void
}

/**
 * Reusable Excel-style column header filter component.
 * Features: Search inside values, Multi-select, Clear/Select All.
 */
export function ColumnHeaderFilter({ columnKey, label, data, selectedValues, onFilterChange }: ColumnHeaderFilterProps) {
  const [search, setSearch] = React.useState("")
  
  const uniqueValues = React.useMemo(() => {
    if (!data) return []
    const values = new Set(data.map(item => String(item[columnKey] || "")))
    return Array.from(values).sort((a, b) => {
      // Natural sort for numbers/strings
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    })
  }, [data, columnKey])

  const filteredValues = uniqueValues.filter(v => 
    v.toLowerCase().includes(search.toLowerCase())
  )

  const toggleValue = (val: string) => {
    const next = selectedValues.includes(val)
      ? selectedValues.filter(v => v !== val)
      : [...selectedValues, val]
    onFilterChange(next)
  }

  const isActive = selectedValues.length > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={cn(
            "p-1.5 hover:bg-slate-200 rounded-md transition-all ml-auto group/filter-btn",
            isActive && "text-primary bg-primary/10"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className={cn("h-3 w-3", isActive && "fill-current")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 rounded-xl shadow-2xl border-none overflow-hidden z-[100]" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest">Filter {label}</span>
          {isActive && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-[9px] font-bold text-rose-400 hover:text-rose-300 hover:bg-white/10"
              onClick={() => onFilterChange([])}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="p-3 space-y-3 bg-white">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder={`Search ${label}...`} 
              className="pl-8 h-9 text-xs border-2 rounded-lg font-medium" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <ScrollArea className="h-[200px] pr-2">
            <div className="space-y-1">
              {filteredValues.map((val) => (
                <div 
                  key={val} 
                  className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group"
                  onClick={() => toggleValue(val)}
                >
                  <Checkbox 
                    checked={selectedValues.includes(val)} 
                    onCheckedChange={() => toggleValue(val)}
                  />
                  <span className="text-xs font-medium truncate flex-1 text-slate-700">{val || "(Empty)"}</span>
                  {selectedValues.includes(val) && <Check className="h-3 w-3 text-primary" />}
                </div>
              ))}
              {filteredValues.length === 0 && (
                <p className="text-[10px] text-center py-8 text-muted-foreground italic font-medium">No results found</p>
              )}
            </div>
          </ScrollArea>
          
          {filteredValues.length > 0 && (
            <div className="pt-2 border-t flex justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[9px] font-black uppercase tracking-tight h-7 px-2"
                onClick={() => onFilterChange([])}
              >
                Reset
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[9px] font-black uppercase tracking-tight h-7 px-2 text-primary"
                onClick={() => onFilterChange(uniqueValues)}
              >
                Select All
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
