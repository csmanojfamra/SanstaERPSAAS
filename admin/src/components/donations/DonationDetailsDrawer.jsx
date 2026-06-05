import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useDonationDetail } from '@/hooks/useDonations'
import { formatCurrency, formatDate, formatPaymentMode } from '@/utils/formatters'

function StatusBadges({ statuses = [] }) {
  const styles = {
    RECEIPT_GENERATED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    RECEIPT_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    WHATSAPP_SENT: 'bg-blue-50 text-blue-700 border-blue-200',
    EMAIL_SENT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    PRINTED: 'bg-muted text-foreground border-border',
    REGENERATED: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  const labels = {
    RECEIPT_GENERATED: 'Receipt Generated',
    RECEIPT_PENDING: 'Receipt Pending',
    WHATSAPP_SENT: 'WhatsApp Sent',
    EMAIL_SENT: 'Email Sent',
    PRINTED: 'Printed',
    REGENERATED: 'Regenerated',
  }
  return (
    <div className="flex flex-wrap gap-1">
      {statuses.map((s) => (
        <Badge key={s} variant="outline" className={styles[s] || ''}>
          {labels[s] || s}
        </Badge>
      ))}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-2 border-b pb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

export default function DonationDetailsDrawer({ donationId, open, onOpenChange }) {
  const { data, isLoading } = useDonationDetail(donationId)
  const donation = data?.donation

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <div className="pr-6">
          <h2 className="text-lg font-semibold text-maroon">Donation Details</h2>
          <p className="text-sm text-muted-foreground">{donation?.receipt_number || 'Loading...'}</p>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !donation ? (
          <p className="mt-4 text-sm text-muted-foreground">Donation not found.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <Section title="Donation Information">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Date:</span> {formatDate(donation.donation_date)}</p>
                <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(donation.amount)}</p>
                <p><span className="text-muted-foreground">Purpose:</span> {donation.purpose}</p>
                <p><span className="text-muted-foreground">Mode:</span> {formatPaymentMode(donation.payment_mode)}</p>
              </div>
              {donation.notes ? <p className="text-sm text-muted-foreground">Remarks: {donation.notes}</p> : null}
            </Section>

            <Section title="Donor Information">
              <p className="text-sm font-medium">{donation.donor_name}</p>
              <p className="text-sm text-muted-foreground">{donation.donor_mobile}</p>
              {donation.donor_city ? <p className="text-sm text-muted-foreground">{donation.donor_city}</p> : null}
              <p className="text-xs text-muted-foreground">
                {donation.donor_frequency === 'REPEAT'
                  ? `Repeat Donor · ${donation.donor_donation_count} donations`
                  : 'First Time Donor'}
              </p>
            </Section>

            <Section title="Receipt Information">
              <StatusBadges statuses={donation.receipt_statuses} />
              {donation.pan_number ? (
                <p className="text-sm">PAN: {donation.pan_number}</p>
              ) : donation.pan_recommended ? (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  PAN Recommended
                </Badge>
              ) : null}
            </Section>

            <Section title="Communication History">
              <div className="space-y-1 text-sm">
                <p>
                  WhatsApp:{' '}
                  {data.communication?.whatsapp_sent
                    ? `Sent ${data.communication.whatsapp_sent_at ? formatDate(data.communication.whatsapp_sent_at) : ''}`
                    : 'Not sent'}
                </p>
                <p>Email: {data.communication?.email_sent ? 'Sent' : 'Not sent'}</p>
                <p>
                  Receipt dispatch:{' '}
                  {data.communication?.receipt_sent_at
                    ? formatDate(data.communication.receipt_sent_at)
                    : 'Not recorded'}
                </p>
              </div>
            </Section>

            <Section title="Audit History">
              {!data.audit_history?.length ? (
                <p className="text-sm text-muted-foreground">No audit entries for this donation.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {data.audit_history.map((log) => (
                    <div key={log.id} className="rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-muted-foreground">{log.description}</p>
                      <p className="text-muted-foreground">
                        {log.user?.name || 'System'} · {formatDate(log.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Supporting Documents">
              <p className="text-sm text-muted-foreground">
                {donation.receipt_pdf_path
                  ? 'Receipt PDF is available for download from the register actions menu.'
                  : 'Receipt PDF is pending generation.'}
              </p>
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
