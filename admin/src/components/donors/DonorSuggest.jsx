import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'

export default function DonorSuggest({ query, onPick, children }) {
  const [hits, setHits] = useState([])
  const [open, setOpen] = useState(false)
  const picked = useRef('')

  useEffect(() => {
    const term = String(query || '').trim()
    if (term.length < 2 || term === picked.current) {
      setHits([])
      setOpen(false)
      return undefined
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/donors', { params: { q: term } })
        const donors = data.donors || []
        setHits(donors)
        setOpen(donors.length > 0)
      } catch {
        setHits([])
        setOpen(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="relative">
      {children}
      {open ? (
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-white shadow-md">
          {hits.map((donor) => (
            <li key={`${donor.mobile}-${donor.name}`}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  picked.current = donor.name
                  setOpen(false)
                  onPick(donor)
                }}
              >
                <span className="font-medium">{donor.name}</span>
                <span className="text-muted-foreground">{donor.mobile}</span>
                {donor.city ? <span className="text-muted-foreground">{donor.city}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
