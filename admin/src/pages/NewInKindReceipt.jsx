import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import RequiredLabel from '@/components/common/RequiredLabel'
import InKindLinesEditor, {
  emptyInKindLine,
  mapInKindLinesForApi,
} from '@/components/inkind/InKindLinesEditor'
import { useStockItems, useCreateInKindReceipt } from '@/hooks/useInKind'
import { todayISO } from '@/utils/formatters'
import { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { confirmBackdatedEntry } from '@/lib/formHelpers'

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
  const [lines, setLines] = useState([emptyInKindLine()])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.donor_name.trim() || form.donor_name.trim().length < 2) {
      toast({ title: 'Enter donor name', variant: 'destructive' })
      return
    }
    if (form.donor_mobile && !/^[6-9]\d{9}$/.test(form.donor_mobile)) {
      toast({ title: 'Enter a valid 10-digit mobile (or leave blank)', variant: 'destructive' })
      return
    }
    if (!confirmBackdatedEntry(form.receipt_date, 'in-kind receipt')) return

    const payloadLines = mapInKindLinesForApi(lines)
    if (!payloadLines.length) {
      toast({ title: 'Add at least one item line', variant: 'destructive' })
      return
    }

    try {
      const data = await createReceipt.mutateAsync({
        ...form,
        estimated_value: form.estimated_value === '' ? null : Number(form.estimated_value),
        lines: payloadLines,
      })
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
        description="Record gold, clothes, materials and other non-cash donations. Stock quantity increases; weight is optional detail."
      />
      <Card className="max-w-3xl">
        <CardContent className="space-y-5 pt-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Does not post to Cash Book. For jewellery, set Qty to pieces and enter Weight separately (g / tola).
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <RequiredLabel>Donor name</RequiredLabel>
                <Input
                  value={form.donor_name}
                  onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input
                  value={form.donor_mobile}
                  onChange={(e) => setForm({ ...form, donor_mobile: e.target.value })}
                  placeholder="Optional 10-digit"
                  maxLength={10}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input value={form.donor_city} onChange={(e) => setForm({ ...form, donor_city: e.target.value })} />
              </div>
              <div>
                <RequiredLabel>Receipt date</RequiredLabel>
                <Input
                  type="date"
                  max={todayISO()}
                  value={form.receipt_date}
                  onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Estimated total value (₹, optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.estimated_value}
                  onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                />
              </div>
            </div>

            <InKindLinesEditor items={items} lines={lines} onChange={setLines} />

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button type="submit" disabled={createReceipt.isPending}>
                {createReceipt.isPending ? 'Saving...' : 'Save receipt'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/inkind')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
