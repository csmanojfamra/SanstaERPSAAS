import { Button } from '@/components/ui/button'

export default function VendorExactMatchBanner({ match, linked, onUseExisting }) {
  if (!match) return null

  if (linked) {
    return (
      <p className="sm:col-span-2 text-xs text-emerald-700">
        Using saved vendor: <span className="font-medium">{match.name}</span>
        {match.mobile ? ` · ${match.mobile}` : ''}
      </p>
    )
  }

  return (
    <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
      <p>
        A saved vendor matches this name and mobile:{' '}
        <span className="font-medium">{match.name}</span>
        {match.mobile ? ` · ${match.mobile}` : ''}
      </p>
      <p className="mt-1 text-xs text-amber-800">Choose the existing record to avoid duplicates.</p>
      <Button type="button" size="sm" variant="outline" className="mt-2 bg-white" onClick={() => onUseExisting(match)}>
        Use existing vendor
      </Button>
    </div>
  )
}
