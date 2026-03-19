import React from 'react'
import { Link } from 'react-router-dom'
import { ThumbsUp, MessageSquare, Heart, Share2 } from 'lucide-react'
import type { BuildListItem } from '../types'

interface BuildCardProps {
  build: BuildListItem
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(price)

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

const BuildCard: React.FC<BuildCardProps> = ({ build }) => {
  return (
    <div className="bg-th-surface border border-th-border rounded-lg p-4 hover:border-[#FF6B00]/40 transition-colors">
      {/* Title + sum */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <Link
          to={`/b/${build.short_code}`}
          className="text-th-text font-semibold text-base hover:text-[#FF6B00] transition-colors leading-tight line-clamp-2 flex-1"
        >
          {build.title}
        </Link>
        <span className="text-[#FF6B00] font-bold text-base whitespace-nowrap shrink-0">
          {formatPrice(build.total_price)} ₽
        </span>
      </div>

      {/* Author + date */}
      <div className="flex items-center gap-2 mb-3">
        {build.author_avatar ? (
          <img src={build.author_avatar} alt={build.author_name}
            className="w-5 h-5 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-[#FF6B00]/20 flex items-center justify-center text-[9px] font-bold text-[#FF6B00] shrink-0">
            {build.author_name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-th-text-3 text-xs">{build.author_name}</span>
        {build.workshop_name && (
          <span className="text-th-muted text-xs truncate">• {build.workshop_name}</span>
        )}
        <span className="text-th-muted text-xs ml-auto shrink-0">{formatDate(build.created_at)}</span>
      </div>

      {/* Components count */}
      <p className="text-th-muted text-xs mb-3">
        {build.items_count} {build.items_count === 1 ? 'компонент' : build.items_count < 5 ? 'компонента' : 'компонентов'}
      </p>

      {/* Interaction row */}
      <div className="flex items-center gap-3 pt-2 border-t border-th-border">
        <button className="flex items-center gap-1 text-th-muted hover:text-[#FF6B00] transition-colors text-xs">
          <ThumbsUp size={13} /><span>0</span>
        </button>
        <button className="flex items-center gap-1 text-th-muted hover:text-th-text-2 transition-colors text-xs">
          <MessageSquare size={13} /><span>0</span>
        </button>
        <button className="flex items-center gap-1 text-th-muted hover:text-red-400 transition-colors text-xs">
          <Heart size={13} /><span>0</span>
        </button>
        <button className="flex items-center gap-1 text-th-muted hover:text-th-text-2 transition-colors text-xs ml-auto">
          <Share2 size={13} />
        </button>
      </div>
    </div>
  )
}

export default BuildCard
