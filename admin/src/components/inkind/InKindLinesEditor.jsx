import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import RequiredLabel from '@/components/common/RequiredLabel'
import { useCreateStockItem } from '@/hooks/useInKind'
import { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export const WEIGHT_UNITS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'mg', label: 'mg' },
  { value: 'tola', label: 'tola' },
]

export const emptyInKindLine = () => ({
  stock_item_id: '',
  quantity: '1',
  weight: '',
  weight_unit: 'g',
  description: '',
  estimated_value: '',
})

/**
 * Items table for in-kind receipts.
 * Catalog “new item type” is a secondary CTA (dialog) — not a stock-receive form.
 */
export default function InKindLinesEditor({ items = [], lines, onChange }) {
  const createStockItem = useCreateStockItem()
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogForm, setCatalogForm] = useState({ name: '', unit: 'pcs', category: '' })

  const updateLine = (idx, patch) => {
    onChange(lines.map((line, i) => (i === idx ? { ...line, ...patch } : line)))
  }

  const addLine = () => onChange([...lines, emptyInKindLine()])

  const removeLine = (idx) => {
    if (lines.length === 1) return
    onChange(lines.filter((_, i) => i !== idx))
  }

  const submitCatalogItem = async (e) => {
    e.preventDefault()
    const name = catalogForm.name.trim()
    if (!name) {
      toast({ title: 'Enter item name', variant: 'destructive' })
      return
    }
    try {
      const data = await createStockItem.mutateAsync({
        name,
        unit: catalogForm.unit.trim() || 'pcs',
        category: catalogForm.category.trim() || '',
      })
      toast({ title: 'Item type added to catalog', description: data.item?.name })
      setCatalogOpen(false)
      setCatalogForm({ name: '', unit: 'pcs', category: '' })
      if (data.item?.id) {
        const emptyIdx = lines.findIndex((l) => !l.stock_item_id)
        if (emptyIdx >= 0) updateLine(emptyIdx, { stock_item_id: data.item.id })
        else onChange([...lines, { ...emptyInKindLine(), stock_item_id: data.item.id }])
      }
    } catch (err) {
      toast({ title: 'Could not add item type', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Items received</h3>
          <p className="text-[11px] text-muted-foreground">
            Qty updates stock. Weight is optional detail (e.g. gold / silver jewellery).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setCatalogOpen(true)}>
            New item type…
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add line
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className="grid gap-2.5 rounded-lg border border-border/70 bg-muted/10 p-3 sm:grid-cols-12 sm:items-end"
          >
            <div className="sm:col-span-3">
              <Label className="text-xs">Item</Label>
              <Select value={line.stock_item_id} onValueChange={(v) => updateLine(idx, { stock_item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-1">
              <Label className="text-xs">Qty</Label>
              <Input
                type="number"
                min="0.001"
                step="any"
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Weight (optional)</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  placeholder="e.g. 12.5"
                  value={line.weight}
                  onChange={(e) => updateLine(idx, { weight: e.target.value })}
                  className="min-w-0 flex-1"
                />
                <Select
                  value={line.weight_unit || 'g'}
                  onValueChange={(v) => updateLine(idx, { weight_unit: v })}
                >
                  <SelectTrigger className="w-[72px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEIGHT_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="sm:col-span-3">
              <Label className="text-xs">Description</Label>
              <Input
                value={line.description}
                onChange={(e) => updateLine(idx, { description: e.target.value })}
                placeholder="e.g. Gold chain"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Est. ₹</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={line.estimated_value}
                onChange={(e) => updateLine(idx, { estimated_value: e.target.value })}
              />
            </div>
            <div className="flex justify-end sm:col-span-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                disabled={lines.length === 1}
                onClick={() => removeLine(idx)}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!items.length ? (
        <p className="rounded-md border border-dashed bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          No item types in catalog yet. Use <span className="font-medium">New item type…</span> to add Gold, Clothes, etc. (this only creates the catalog entry — stock increases when you save the receipt).
        </p>
      ) : null}

      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add item type to catalog</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCatalogItem} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Creates a reusable stock item name (not a stock receipt). After saving, pick it in the Item column.
            </p>
            <div>
              <RequiredLabel>Name</RequiredLabel>
              <Input
                value={catalogForm.name}
                onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
                placeholder="e.g. Gold jewellery"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stock unit</Label>
                <Input
                  value={catalogForm.unit}
                  onChange={(e) => setCatalogForm({ ...catalogForm, unit: e.target.value })}
                  placeholder="pcs / g / kg"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={catalogForm.category}
                  onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })}
                  placeholder="e.g. Metal"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCatalogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createStockItem.isPending}>Save item type</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function mapInKindLinesForApi(lines) {
  return lines
    .filter((l) => l.stock_item_id && l.quantity)
    .map((l) => ({
      stock_item_id: l.stock_item_id,
      quantity: Number(l.quantity),
      weight: l.weight === '' || l.weight == null ? null : Number(l.weight),
      weight_unit: l.weight === '' || l.weight == null ? null : l.weight_unit || 'g',
      description: l.description || '',
      estimated_value: l.estimated_value === '' || l.estimated_value == null ? null : Number(l.estimated_value),
    }))
}
