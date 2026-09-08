import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Plus, ArrowDownCircle } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import FilterToolbar from '@/components/common/FilterToolbar'
import CompactStatCard from '@/components/common/CompactStatCard'
import EmptyState from '@/components/common/EmptyState'
import TableLoadingSkeleton from '@/components/common/TableLoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStockItems, useCreateStockItem, useUtiliseStock, useInKindReceipts, useStockMovements } from '@/hooks/useInKind'
import { formatCurrency, todayISO } from '@/utils/formatters'
import { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import RequiredLabel from '@/components/common/RequiredLabel'

export default function InKindStock() {
  const [search, setSearch] = useState('')
  const { data: itemsData, isLoading, isError, error } = useStockItems(true)
  const { data: receiptsData } = useInKindReceipts({ page: 1, limit: 8 })
  const { data: movementsData } = useStockMovements({ page: 1, limit: 10, movement_type: 'UTILISE' })
  const createItem = useCreateStockItem()
  const utilise = useUtiliseStock()

  const [itemOpen, setItemOpen] = useState(false)
  const [utiliseOpen, setUtiliseOpen] = useState(false)
  const [itemForm, setItemForm] = useState({ name: '', unit: 'pcs', category: '', notes: '' })
  const [utiliseForm, setUtiliseForm] = useState({
    stock_item_id: '',
    quantity: '',
    movement_date: todayISO(),
    reason: '',
  })

  const items = itemsData?.items || []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
    )
  }, [items, search])

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, item) => {
        acc.skus += 1
        acc.balance += Number(item.stock?.balance || 0)
        acc.inbound += Number(item.stock?.inbound || 0)
        acc.utilised += Number(item.stock?.utilised || 0)
        return acc
      },
      { skus: 0, balance: 0, inbound: 0, utilised: 0 }
    )
  }, [filtered])

  const submitItem = async (e) => {
    e.preventDefault()
    try {
      await createItem.mutateAsync(itemForm)
      toast({ title: 'Stock item added' })
      setItemOpen(false)
      setItemForm({ name: '', unit: 'pcs', category: '', notes: '' })
    } catch (err) {
      toast({ title: 'Could not add item', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  const submitUtilise = async (e) => {
    e.preventDefault()
    try {
      await utilise.mutateAsync({
        ...utiliseForm,
        quantity: Number(utiliseForm.quantity),
      })
      toast({ title: 'Utilisation recorded' })
      setUtiliseOpen(false)
      setUtiliseForm({ stock_item_id: '', quantity: '', movement_date: todayISO(), reason: '' })
    } catch (err) {
      toast({ title: 'Utilisation failed', description: getApiErrorMessage(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="In-Kind Stock"
        description="Receive goods (gold, clothes, materials), track stock, and record utilisation."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setUtiliseOpen(true)}>
              <ArrowDownCircle className="mr-1 h-4 w-4" /> Record utilisation
            </Button>
            <Button variant="outline" onClick={() => setItemOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add item
            </Button>
            <Button asChild>
              <Link to="/inkind/receipts/new">
                <Plus className="mr-1 h-4 w-4" /> New in-kind receipt
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CompactStatCard label="Active SKUs" value={totals.skus} />
        <CompactStatCard label="Total inbound qty" value={totals.inbound.toLocaleString('en-IN')} />
        <CompactStatCard label="Utilised qty" value={totals.utilised.toLocaleString('en-IN')} />
        <CompactStatCard label="On-hand qty" value={totals.balance.toLocaleString('en-IN')} />
      </div>

      <FilterToolbar>
        <Input
          placeholder="Search item or category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </FilterToolbar>

      {isError ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
      ) : isLoading ? (
        <TableLoadingSkeleton rows={6} />
      ) : !filtered.length ? (
        <EmptyState
          icon={Package}
          title="No stock items yet"
          description="Add items like Gold, Clothes, Cement — then record in-kind receipts."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Utilised</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : undefined}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.category || '—'}</TableCell>
                    <TableCell className="text-right">{Number(item.stock?.inbound || 0)}</TableCell>
                    <TableCell className="text-right">{Number(item.stock?.utilised || 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(item.stock?.balance || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent in-kind receipts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(receiptsData?.receipts || []).length === 0 ? (
              <p className="text-muted-foreground">No receipts yet.</p>
            ) : (
              (receiptsData?.receipts || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="font-medium">{r.receipt_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.donor_name} · {new Date(r.receipt_date).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <p className="text-xs">
                    {r.estimated_value != null ? formatCurrency(r.estimated_value) : `${r.lines?.length || 0} line(s)`}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent utilisations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(movementsData?.movements || []).length === 0 ? (
              <p className="text-muted-foreground">No utilisation recorded.</p>
            ) : (
              (movementsData?.movements || []).map((m) => (
                <div key={m.id} className="border-b py-2 last:border-0">
                  <p className="font-medium">
                    {m.quantity} {m.stock_item?.unit} · {m.stock_item?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.reason} · {new Date(m.movement_date).toLocaleDateString('en-IN')}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add stock item</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitItem} className="space-y-3">
            <div>
              <RequiredLabel>Name</RequiredLabel>
              <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit</Label>
                <Input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="e.g. Metal, Cloth" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createItem.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={utiliseOpen} onOpenChange={setUtiliseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record utilisation</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitUtilise} className="space-y-3">
            <div>
              <RequiredLabel>Item</RequiredLabel>
              <Select value={utiliseForm.stock_item_id} onValueChange={(v) => setUtiliseForm({ ...utiliseForm, stock_item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {items.filter((i) => i.is_active).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} (bal: {Number(i.stock?.balance || 0)} {i.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <RequiredLabel>Quantity</RequiredLabel>
                <Input type="number" min="0.001" step="any" value={utiliseForm.quantity} onChange={(e) => setUtiliseForm({ ...utiliseForm, quantity: e.target.value })} required />
              </div>
              <div>
                <RequiredLabel>Date</RequiredLabel>
                <Input type="date" value={utiliseForm.movement_date} onChange={(e) => setUtiliseForm({ ...utiliseForm, movement_date: e.target.value })} required />
              </div>
            </div>
            <div>
              <RequiredLabel>Reason / use</RequiredLabel>
              <Textarea value={utiliseForm.reason} onChange={(e) => setUtiliseForm({ ...utiliseForm, reason: e.target.value })} required placeholder="e.g. Used in temple decoration" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUtiliseOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={utilise.isPending || !utiliseForm.stock_item_id}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
