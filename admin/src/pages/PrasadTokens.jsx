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
import DonorSuggest from '@/components/donors/DonorSuggest'

function packetPreview(amount, rate) {
  const rupees = Number(amount)
  const perPacket = Math.max(1, Math.floor(Number(rate) || 100))
  if (!rupees || rupees <= 0) return 0
  return Math.max(1, Math.floor(rupees / perPacket))
}

function whatsappNote(whatsapp) {
  if (!whatsapp) return ''
  if (whatsapp.sent) return 'WhatsApp par token link chala gaya.'
  if (whatsapp.reason === 'not_configured' || whatsapp.reason === 'whatsapp_disabled') {
    return 'WhatsApp abhi connected nahi hai. Print slip kaam karegi.'
  }
  return `WhatsApp nahi gaya: ${whatsapp.reason || 'unknown'}. Print slip kaam karegi.`
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

  const tokensQuery = useQuery({
    queryKey: ['prasad-tokens'],
    queryFn: async () => {
      const { data } = await api.get('/prasad-tokens')
      return data.tokens || []
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
      toast({
        title: `${data.token.packets} packet ka token ban gaya`,
        description: whatsappNote(data.whatsapp),
      })
    },
    onError: (err) => {
      toast({ title: 'Token nahi bana', description: getApiErrorMessage(err), variant: 'destructive' })
    },
  })

  const packets = packetPreview(form.amount, form.rupees_per_packet)
  const trustName = trust?.name_hindi || trust?.name || 'Mandir'

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
        description="Counter pe naam aur amount likho. Print aur WhatsApp dono par ek baar chalega QR."
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
                {packets > 0 ? `${packets} packet dena hai.` : 'Amount likhte hi packet count dikhega.'}
              </p>
              <Button type="submit" disabled={issue.isPending}>
                {issue.isPending ? 'Ban raha hai...' : 'Token banao'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {slip ? (
          <Card className="mx-auto w-full max-w-sm">
            <CardContent className="pt-6 text-center">
              <p className="text-sm font-semibold text-maroon">{trustName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Prasad token — ek baar</p>
              <p className="mt-3 text-5xl font-bold text-maroon">{slip.packets}</p>
              <p className="text-sm text-muted-foreground">packet</p>
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
              Token banne ke baad yahan QR slip aayegi. Phone camera se scan karte hi counter ko naam, amount aur packet count dikhega. “Prasad de diya” ek hi baar chalega.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-4 print:hidden">
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Aaj ke tokens</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => tokensQuery.refetch()}>
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Mobile</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Packets</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(tokensQuery.data || []).map((token) => (
                  <tr key={token.id} className="border-b">
                    <td className="py-2 pr-3">{token.donor_name}</td>
                    <td className="py-2 pr-3">{token.donor_mobile}</td>
                    <td className="py-2 pr-3">{formatCurrency(token.amount)}</td>
                    <td className="py-2 pr-3">{token.packets}</td>
                    <td className="py-2">{token.status === 'REDEEMED' ? 'Used' : 'Open'}</td>
                  </tr>
                ))}
                {!tokensQuery.isLoading && (tokensQuery.data || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-muted-foreground">
                      Abhi koi token nahi hai.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
