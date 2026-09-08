import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import RequiredLabel from '@/components/common/RequiredLabel'
import { useStockItems, useCreateInKindReceipt } from '@/hooks/useInKind'
import { todayISO } from '@/utils/formatters'
import { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

const emptyLine = () => ({ stock_item_id: '', quantity: '', description: '', estimated_value: '' })

export default function NewInKindReceipt() {
  const navigate = useNavigate()
  const { data: itemsData } = useStockItems(false)
  const createReceipt = useCreateInKindReceipt()
  const items = itemsData?.items || []

  const [form, setForm] = useState({
    donor_name: '',
    donor_mobile: '',
    donor_city: '',
    receipt_date: todayISO(),
    notes: '',
    estimated_value: '',
  })
  const [lines, setLines] = useState([emptyLine()])

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      estimated_value: form.estimated_value === '' ? null : Number(form.estimated_value),
      lines: lines
        .filter((l) => l.stock_item_id && l.quantity)
        .map((l) => ({
          stock_item_id: l.stock_item_id,
          quantity: Number(l.quantity),
          description: l.description || '',
          estimated_value: l.estimated_value === '' ? null : Number(l.estimated_value),
        })),
    }
    if (!payload.lines.length) {
      toast({ title: 'Add at least one item line', variant: 'destructive' })
      return
    }
    try {
      const data = await createReceipt.mutateAsync(payload)
      toast({ title: 'In-kind receipt saved', description: data.receipt?.receipt_number })
      navigate('/inkind')
    } catch (err) {
      toast({ title: 'Could not save receipt', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="New In-Kind Receipt"
        description="Record gold, clothes, materials and other non-cash donations. Stock increases automatically."
      />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <RequiredLabel>Donor name</RequiredLabel>
                <Input value={form.donor_name} onChange={(e) => setForm({ ...form, donor_name: e.target.value })} required />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input value={form.donor_mobile} onChange={(e) => setForm({ ...form, donor_mobile: e.target.value })} placeholder="10-digit mobile" />
              </div>
              <div>
                <Label>City</Label>
                <Input value={form.donor_city} onChange={(e) => setForm({ ...form, donor_city: e.target.value })} />
              </div>
              <div>
                <RequiredLabel>Receipt date</RequiredLabel>
                <Input type="date" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} required />
              </div>
              <div>
                <Label>Estimated total value (₹, optional)</Label>
                <Input type="number" min="0" step="any" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Items received</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add line
                </Button>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <Label>Item</Label>
                    <Select value={line.stock_item_id} onValueChange={(v) => updateLine(idx, { stock_item_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Qty</Label>
                    <Input type="number" min="0.001" step="any" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} required />
                  </div>
                  <div className="sm:col-span-3">
                    <Label>Description</Label>
                    <Input value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} placeholder="e.g. Gold chain" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Est. ₹</Label>
                    <Input type="number" min="0" step="any" value={line.estimated_value} onChange={(e) => updateLine(idx, { estimated_value: e.target.value })} />
                  </div>
                  <div className="flex items-end sm:col-span-1">
                    <Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {!items.length ? (
                <p className="text-sm text-muted-foreground">No stock items yet. Add an item from In-Kind Stock first.</p>
              ) : null}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/inkind')}>Cancel</Button>
              <Button type="submit" disabled={createReceipt.isPending}>Save receipt</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
