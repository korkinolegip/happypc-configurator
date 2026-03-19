import React from 'react'
import { Link } from 'react-router-dom'
import { ThumbsUp, MessageSquare, Heart, Share2 } from 'lucide-react'
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
      {/* Header: title + code + date + price */}
      <div className="px-4 pt-4 pb-3 border-b border-th-border">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex-1 min-w-0">
            <h3 className="text-th-text font-bold text-[15px] leading-tight">
              Сборка: <span className="text-[#FF6B00]">{build.short_code}</span>
            </h3>
            {build.title !== `Сборка ${build.short_code}` && build.title && (
              <p className="text-th-text-2 text-sm mt-0.5 truncate">{build.title}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-th-text-3 text-[10px] uppercase tracking-wide">Сумма:</div>
            <div className="text-[#FF6B00] font-bold text-lg leading-tight">
              {formatPrice(build.total_price)} ₽
            </div>
          </div>
        </div>
        <div className="text-th-text-3 text-xs">
          {formatDateTime(build.created_at)}
        </div>
      </div>

      {/* Components list with mini icons */}
      {build.components && build.components.length > 0 && (
        <div className="px-4 py-3 border-b border-th-border">
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {build.components.slice(0, 8).map((comp, i) => (
              <div key={i} className="flex items-center gap-1.5 text-th-text-2 text-xs">
                <CategoryIcon category={comp.category} size={14} />
                <span className="truncate max-w-[180px]">{comp.name}</span>
              </div>
            ))}
            {build.components.length > 8 && (
              <span className="text-th-text-3 text-xs">
                +{build.components.length - 8} ещё
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer: author + interactions */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        {/* Author */}
        <div className="flex items-center gap-2">
          {build.author_avatar ? (
            <img
              src={build.author_avatar}
              alt={build.author_name}
              className="w-6 h-6 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-[10px] font-bold text-[#FF6B00] shrink-0">
              {build.author_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-th-text text-sm font-medium">{build.author_name}</span>
          {build.workshop_name && (
            <span className="text-th-text-3 text-xs hidden sm:inline">• {build.workshop_name}</span>
          )}
        </div>

        {/* Interactions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1 text-th-muted hover:text-[#FF6B00] transition-colors text-xs"
          >
            <ThumbsUp size={14} />
            <span>0</span>
          </button>
          <button
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1 text-th-muted hover:text-th-text-2 transition-colors text-xs"
          >
            <MessageSquare size={14} />
            <span>0</span>
          </button>
          <button
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1 text-th-muted hover:text-red-400 transition-colors text-xs"
          >
            <Heart size={14} />
          </button>
          <button
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1 text-th-muted hover:text-th-text-2 transition-colors text-xs"
          >
            <Share2 size={14} />
          </button>
        </div>
      </div>
    </Link>
  )
}

export default BuildCard
