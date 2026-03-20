import React from 'react'
import { Link } from 'react-router-dom'
import { ThumbsUp, MessageSquare, Eye, Share2 } from 'lucide-react'
import CategoryIcon from './CategoryIcon'
import toast from 'react-hot-toast'
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

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/b/${build.short_code}`
    navigator.clipboard.writeText(url)
    toast.success('Ссылка скопирована')
  }

  return (
    <Link
      to={`/b/${build.short_code}`}
      className="block bg-th-surface border border-th-border rounded-lg hover:border-[#FF6B00]/50 transition-all hover:shadow-th-lg"
    >
      {/* Header: title + date + price on one line */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-th-text font-bold text-[17px] leading-snug line-clamp-2">
              {build.title || `Сборка ${build.short_code}`}
            </h3>
            <div className="text-th-text-3 text-xs mt-1.5">
              {formatDateTime(build.created_at)}
            </div>
          </div>

          {/* Price — "Сумма:" and value on one line, both large */}
          <div className="flex items-baseline gap-2 shrink-0 pl-2 whitespace-nowrap">
            <span className="text-th-text-2 font-semibold text-base">Сумма:</span>
            <span className="text-[#FF6B00] font-bold text-xl">{formatPrice(build.total_price)} ₽</span>
          </div>
        </div>
      </div>

      {/* Components — each on its own line with icon */}
      {build.components && build.components.length > 0 && (
        <div className="px-5 py-3 border-t border-th-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
            {build.components.slice(0, 8).map((comp, i) => (
              <div key={i} className="flex items-center gap-2.5 min-w-0">
                <CategoryIcon category={comp.category} size={20} color="#FF6B00" />
                <span className="text-th-text-2 text-[13px] leading-tight truncate">{comp.name}</span>
              </div>
            ))}
          </div>
          {build.components.length > 8 && (
            <p className="text-th-text-3 text-xs mt-2 pl-8">
              +{build.components.length - 8} ещё
            </p>
          )}
        </div>
      )}

      {/* Footer: author + interactions */}
      <div className="px-5 py-3 border-t border-th-border flex items-center justify-between">
        {/* Author — avatar 15-20% bigger (was 32px → 38px) */}
        <div className="flex items-center gap-2.5">
          {build.author_avatar ? (
            <img
              src={build.author_avatar}
              alt={build.author_name}
              className="w-[38px] h-[38px] rounded-full object-cover shrink-0 border border-th-border"
            />
          ) : (
            <div className="w-[38px] h-[38px] rounded-full bg-[#FF6B00]/20 border border-[#FF6B00]/30 flex items-center justify-center text-sm font-bold text-[#FF6B00] shrink-0">
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
        <div className="flex items-center gap-1 bg-th-surface-2 rounded-lg px-1 py-0.5">
          <div
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors cursor-pointer"
          >
            <ThumbsUp size={18} />
            <span className="text-sm font-medium">0</span>
          </div>
          <div className="w-px h-5 bg-th-border" />
          <div
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors cursor-pointer"
          >
            <MessageSquare size={18} />
            <span className="text-sm font-medium">0</span>
          </div>
          <div className="w-px h-5 bg-th-border" />
          <div
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors cursor-pointer"
          >
            <Eye size={18} />
            <span className="text-sm font-medium">0</span>
          </div>
          <div className="w-px h-5 bg-th-border" />
          <div
            onClick={handleShare}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors cursor-pointer"
            title="Копировать ссылку"
          >
            <Share2 size={17} />
          </div>
        </div>
      </div>
    </Link>
  )
}

export default BuildCard
