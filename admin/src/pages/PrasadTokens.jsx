import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import api, { getApiErrorMessage } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/useAuthStore'
import { formatCurrency } from '@/utils/formatters'

function formatWhen(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
import DonorSuggest from '@/components/donors/DonorSuggest'

function todayIst() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function packetPreview(amount, rate) {
  const rupees = Number(amount)
  const perPacket = Math.max(1, Math.floor(Number(rate) || 100))
  if (!rupees || rupees <= 0) return 0
  return Math.max(1, Math.floor(rupees / perPacket))
}

function AccountTable({ title, label, rows, total }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{label}</th>
              <th className="py-2 pr-3 font-medium">Tokens</th>
              <th className="py-2 pr-3 font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Packets</th>
              <th className="py-2 pr-3 font-medium">Given</th>
              <th className="py-2 font-medium">Still open</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 text-muted-foreground">No tokens in this period.</td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.key} className="border-b">
                <td className="py-2 pr-3">{row.label}</td>
                <td className="py-2 pr-3">{row.tokens}</td>
                <td className="py-2 pr-3">{formatCurrency(row.amount)}</td>
                <td className="py-2 pr-3">{row.packets}</td>
                <td className="py-2 pr-3">{row.given_packets}</td>
                <td className="py-2">{row.open_packets}</td>
              </tr>
            ))}
            {rows.length > 0 ? (
              <tr className="font-semibold">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3">{total.tokens}</td>
                <td className="py-2 pr-3">{formatCurrency(total.amount)}</td>
                <td className="py-2 pr-3">{total.packets}</td>
                <td className="py-2 pr-3">{total.given_packets}</td>
                <td className="py-2">{total.open_packets}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function whatsappNote(whatsapp) {
  if (!whatsapp) return ''
  if (whatsapp.sent) return 'The QR was sent on WhatsApp.'
  if (whatsapp.reason === 'not_configured' || whatsapp.reason === 'whatsapp_disabled') {
    return 'WhatsApp is not connected. The printed slip still works.'
  }
  return `WhatsApp was not sent: ${whatsapp.reason || 'unknown'}. The printed slip still works.`
}

export default function PrasadTokens() {
  const qc = useQueryClient()
  const trust = useAuthStore((s) => s.trust)
  const [form, setForm] = useState({
    donor_name: '',
    donor_mobile: '',
    amount: '',
    rupees_per_packet: '100',
  })
  const [slip, setSlip] = useState(null)
  const [filters, setFilters] = useState({ q: '', from: '', to: '', status: '' })
  const [accountRange, setAccountRange] = useState(() => {
    const day = todayIst()
    return { from: day, to: day }
  })
  const [page, setPage] = useState(1)
  const [sendingId, setSendingId] = useState('')

  const tokensQuery = useQuery({
    queryKey: ['prasad-tokens', filters, page],
    queryFn: async () => {
      const { data } = await api.get('/prasad-tokens', {
        params: { ...filters, page, limit: 50 },
      })
      return data
    },
  })

  const issue = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/prasad-tokens', payload)
      return data
    },
    onSuccess: (data) => {
      setSlip({ ...data.token, whatsapp: data.whatsapp })
      setForm((prev) => ({ ...prev, donor_name: '', donor_mobile: '', amount: '' }))
      qc.invalidateQueries({ queryKey: ['prasad-tokens'] })
      qc.invalidateQueries({ queryKey: ['prasad-account'] })
      toast({
        title: `Token created for ${data.token.packets} packet${data.token.packets === 1 ? '' : 's'}`,
        description: whatsappNote(data.whatsapp),
      })
    },
    onError: (err) => {
      toast({ title: 'Could not create token', description: getApiErrorMessage(err), variant: 'destructive' })
    },
  })

  const packets = packetPreview(form.amount, form.rupees_per_packet)
  const trustName = trust?.name_hindi || trust?.name || 'Mandir'

  const accountQuery = useQuery({
    queryKey: ['prasad-account', accountRange],
    queryFn: async () => {
      const { data } = await api.get('/prasad-tokens/account', { params: accountRange })
      return data.account
    },
  })

  const tokens = tokensQuery.data?.tokens || []
  const summary = tokensQuery.data?.summary
  const total = tokensQuery.data?.total || 0
  const pageCount = Math.max(1, Math.ceil(total / 50))

  function updateFilter(key, value) {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  async function sendQr(token) {
    setSendingId(token.id)
    try {
      const { data } = await api.post(`/prasad-tokens/${token.id}/whatsapp`)
      qc.invalidateQueries({ queryKey: ['prasad-tokens'] })
      toast({
        title: data.whatsapp?.sent ? 'QR sent on WhatsApp' : 'QR was not sent',
        description: whatsappNote(data.whatsapp),
        variant: data.whatsapp?.sent ? 'default' : 'destructive',
      })
    } catch (err) {
      toast({ title: 'Could not send QR', description: getApiErrorMessage(err), variant: 'destructive' })
    } finally {
      setSendingId('')
    }
  }

  function onSubmit(event) {
    event.preventDefault()
    issue.mutate({
      donor_name: form.donor_name.trim(),
      donor_mobile: form.donor_mobile.trim(),
      amount: Number(form.amount),
      rupees_per_packet: Number(form.rupees_per_packet) || 100,
    })
  }

  return (
    <div>
      <PageHeader
        title="Prasad tokens"
        mobileTitle="Prasad"
        description="Enter the name and amount at the counter. Print the slip and send the same one-time QR on WhatsApp."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] print:block">
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <DonorSuggest
                  query={form.donor_name}
                  onPick={(donor) =>
                    setForm((prev) => ({
                      ...prev,
                      donor_name: donor.name,
                      donor_mobile: donor.mobile || prev.donor_mobile,
                    }))
                  }
                >
                  <Input
                    value={form.donor_name}
                    autoComplete="off"
                    onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
                    required
                    minLength={2}
                  />
                </DonorSuggest>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Mobile</label>
                <Input
                  value={form.donor_mobile}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setForm({ ...form, donor_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  required
                  pattern="[6-9][0-9]{9}"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Amount (₹)</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">₹ per packet</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={form.rupees_per_packet}
                    onChange={(e) => setForm({ ...form, rupees_per_packet: e.target.value })}
                    required
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {packets > 0
                  ? `₹${Number(form.amount).toLocaleString('en-IN')} at ₹${Math.max(1, Math.floor(Number(form.rupees_per_packet) || 100))} per packet = ${packets} packet${packets === 1 ? '' : 's'}.`
                  : 'Enter an amount to see the packet count.'}
              </p>
              <Button type="submit" disabled={issue.isPending}>
                {issue.isPending ? 'Creating...' : 'Create token'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {slip ? (
          <Card className="mx-auto w-full max-w-sm">
            <CardContent className="pt-6 text-center">
              <p className="text-sm font-semibold text-maroon">{trustName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Prasad token — one time only</p>
              <p className="mt-3 text-5xl font-bold text-maroon">{slip.packets}</p>
              <p className="text-sm text-muted-foreground">{slip.packets === 1 ? 'packet' : 'packets'}</p>
              <p className="mt-3 text-base font-medium">{slip.donor_name}</p>
              <p className="text-sm">{slip.donor_mobile}</p>
              <p className="text-sm">{formatCurrency(slip.amount)}</p>
              {slip.qr_data_url ? (
                <img src={slip.qr_data_url} alt="Prasad token QR" className="mx-auto mt-3 h-52 w-52" />
              ) : null}
              <p className="mt-2 break-all text-[11px] text-muted-foreground">{slip.public_url}</p>
              <p className="mt-2 text-xs text-muted-foreground print:hidden">{whatsappNote(slip.whatsapp)}</p>
              <Button type="button" className="mt-3 print:hidden" onClick={() => window.print()}>
                Print
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="print:hidden">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              The QR slip appears here after you create a token. A phone camera opens the name, amount, and packet count. Mark given works only once.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-4 print:hidden">
        <CardContent className="pt-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Prasad account</h2>
              <p className="text-xs text-muted-foreground">
                Tokens, money collected, and packets, split by packet rate and by token amount.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const day = todayIst()
                  setAccountRange({ from: day, to: day })
                }}
              >
                Today
              </Button>
              <Input
                type="date"
                aria-label="Account from"
                className="w-40"
                value={accountRange.from}
                onChange={(e) => setAccountRange((prev) => ({ ...prev, from: e.target.value }))}
              />
              <Input
                type="date"
                aria-label="Account to"
                className="w-40"
                value={accountRange.to}
                onChange={(e) => setAccountRange((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>
          </div>
          {accountQuery.data ? (
            <div className="grid gap-6">
              <AccountTable
                title="By packet rate"
                label="Rate"
                rows={(accountQuery.data.by_rate || []).map((row) => ({
                  key: row.value,
                  label: `${formatCurrency(row.value)} per packet`,
                  ...row,
                }))}
                total={accountQuery.data.total}
              />
              <AccountTable
                title="By token amount"
                label="Token"
                rows={(accountQuery.data.by_amount || []).map((row) => ({
                  key: row.value,
                  label: `${formatCurrency(row.value)} token`,
                  ...row,
                }))}
                total={accountQuery.data.total}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{accountQuery.isLoading ? 'Loading account...' : 'No account yet.'}</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 print:hidden">
        <CardContent className="pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Token register</h2>
              <p className="text-xs text-muted-foreground">Search a name or mobile to see every token that person has taken.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => tokensQuery.refetch()}>
              Refresh
            </Button>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Name or mobile"
              value={filters.q}
              onChange={(e) => updateFilter('q', e.target.value)}
            />
            <Input type="date" aria-label="From date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
            <Input type="date" aria-label="To date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ISSUED">Open</option>
              <option value="REDEEMED">Used</option>
            </select>
          </div>
          {summary ? (
            <p className="mb-3 text-sm text-muted-foreground">
              {summary.count} tokens · {formatCurrency(summary.amount)} · {summary.packets} packets · {summary.redeemed} used · {summary.open} open
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Mobile</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Rate</th>
                  <th className="py-2 pr-3 font-medium">Packets</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">WhatsApp</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id} className="border-b">
                    <td className="whitespace-nowrap py-2 pr-3">{formatWhen(token.created_at)}</td>
                    <td className="py-2 pr-3">{token.donor_name}</td>
                    <td className="py-2 pr-3">{token.donor_mobile}</td>
                    <td className="py-2 pr-3">{formatCurrency(token.amount)}</td>
                    <td className="py-2 pr-3">{formatCurrency(token.rupees_per_packet)} / pkt</td>
                    <td className="py-2 pr-3">{token.packets}</td>
                    <td className="py-2 pr-3">{token.status === 'REDEEMED' ? 'Used' : 'Open'}</td>
                    <td className="py-2 pr-3">{token.whatsapp_sent ? 'Sent' : 'Not sent'}</td>
                    <td className="py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sendingId === token.id}
                        onClick={() => sendQr(token)}
                      >
                        {sendingId === token.id ? 'Sending...' : 'Send QR'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!tokensQuery.isLoading && tokens.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-4 text-muted-foreground">
                      No tokens for this search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {pageCount > 1 ? (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page} of {pageCount}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
