import React from 'react'
import { Link } from 'react-router-dom'
import { ThumbsUp, MessageSquare, Eye, Share2 } from 'lucide-react'
import CategoryIcon from './CategoryIcon'
import type { BuildListItem } from '../types'

interface BuildCardProps {
  build: BuildListItem
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(price)

const formatDateTime = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const BuildCard: React.FC<BuildCardProps> = ({ build }) => {
  return (
    <Link
      to={`/b/${build.short_code}`}
      className="block bg-th-surface border border-th-border rounded-lg hover:border-[#FF6B00]/50 transition-all hover:shadow-th-lg"
    >
      {/* Row 1: Title + Price */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-th-text font-bold text-base leading-snug line-clamp-2">
              {build.title || `Сборка ${build.short_code}`}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-th-text-3 text-xs">
              <span>{formatDateTime(build.created_at)}</span>
              <span className="text-th-muted">#{build.short_code}</span>
            </div>
          </div>
          <div className="text-right shrink-0 pl-2">
            <div className="text-th-text-3 text-[10px] font-medium uppercase tracking-wider">Сумма:</div>
            <div className="text-[#FF6B00] font-bold text-xl leading-tight whitespace-nowrap">
              {formatPrice(build.total_price)} ₽
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Components with mini icons */}
      {build.components && build.components.length > 0 && (
        <div className="px-4 py-2.5 border-t border-th-border">
          <div className="flex flex-wrap items-center gap-1 text-th-text-2 text-xs leading-relaxed">
            {build.components.map((comp, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-th-muted mx-0.5">|</span>}
                <span className="inline-flex items-center gap-1">
                  <CategoryIcon category={comp.category} size={13} />
                  <span>{comp.name}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: Author + Interactions */}
      <div className="px-4 py-3 border-t border-th-border flex items-center justify-between">
        {/* Author */}
        <div className="flex items-center gap-2.5">
          {build.author_avatar ? (
            <img
              src={build.author_avatar}
              alt={build.author_name}
              className="w-7 h-7 rounded-full object-cover shrink-0 border border-th-border"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#FF6B00]/20 border border-[#FF6B00]/30 flex items-center justify-center text-[11px] font-bold text-[#FF6B00] shrink-0">
              {build.author_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="text-th-text text-sm font-medium block leading-tight">{build.author_name}</span>
            {build.workshop_name && (
              <span className="text-th-text-3 text-[11px] leading-tight">{build.workshop_name}</span>
            )}
          </div>
        </div>

        {/* Interactions */}
        <div className="flex items-center gap-1">
          <div
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-th-muted hover:text-[#FF6B00] hover:bg-[#FF6B00]/5 transition-colors cursor-pointer"
          >
            <ThumbsUp size={16} />
            <span className="text-xs font-medium">0</span>
          </div>
          <div
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-th-muted hover:text-th-text-2 hover:bg-th-surface-2 transition-colors cursor-pointer"
          >
            <MessageSquare size={16} />
            <span className="text-xs font-medium">0</span>
          </div>
          <div
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-th-muted hover:text-th-text-2 hover:bg-th-surface-2 transition-colors cursor-pointer"
          >
            <Eye size={16} />
            <span className="text-xs font-medium">0</span>
          </div>
          <div
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-th-muted hover:text-th-text-2 hover:bg-th-surface-2 transition-colors cursor-pointer"
          >
            <Share2 size={16} />
          </div>
        </div>
      </div>
    </Link>
  )
}

export default BuildCard
