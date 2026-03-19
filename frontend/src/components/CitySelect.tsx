import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCities } from '../api/builds'
import { MapPin, ChevronDown, X } from 'lucide-react'

interface CitySelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  withBuilds?: boolean
  className?: string
}

const CitySelect: React.FC<CitySelectProps> = ({
  value,
  onChange,
  placeholder = 'Выберите город',
  withBuilds = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const { data: cities } = useQuery({
    queryKey: ['cities', withBuilds],
    queryFn: () => getCities(withBuilds),
    staleTime: 5 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    if (!cities) return []
    if (!search) return cities
    const term = search.toLowerCase()
    return cities.filter((c) => c.name.toLowerCase().includes(term))
  }, [cities, search])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch('') }}
        className="input-field w-full text-left flex items-center justify-between gap-2"
      >
        <span className={value ? 'text-th-text' : 'text-th-muted'}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
                setOpen(false)
              }}
              className="text-th-muted hover:text-th-text cursor-pointer"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={14} className={`text-th-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-th-surface border border-th-border rounded-lg shadow-xl max-h-60 overflow-hidden">
          <div className="p-2 border-b border-th-border">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск города..."
              className="w-full bg-th-surface-3 border border-th-border rounded px-3 py-1.5 text-sm text-th-text placeholder-th-placeholder outline-none focus:border-[#FF6B00]"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-th-muted text-sm">Не найдено</div>
            ) : (
              filtered.map((city) => (
                <button
                  key={city.name}
                  type="button"
                  onClick={() => {
                    onChange(city.name)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-th-surface-2 transition-colors flex items-center gap-2 ${
                    value === city.name ? 'text-[#FF6B00] bg-[#FF6B00]/5' : 'text-th-text'
                  }`}
                >
                  <MapPin size={12} className="text-th-muted shrink-0" />
                  {city.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CitySelect
