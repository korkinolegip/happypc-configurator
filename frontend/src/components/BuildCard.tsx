import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ThumbsUp, MessageSquare, Eye, Share2, Copy, Check } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/b/${build.short_code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Ссылка скопирована')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Link
      to={`/b/${build.short_code}`}
      className="block bg-th-surface border border-th-border rounded-lg hover:border-[#FF6B00]/50 transition-all hover:shadow-th-lg"
    >
      {/* Header: title + price */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-th-text font-bold text-[17px] leading-snug line-clamp-2">
              {build.title || `Сборка ${build.short_code}`}
            </h3>
            <div className="text-th-text-3 text-xs mt-1.5">
              {formatDateTime(build.created_at)}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-th-muted text-[11px] font-mono">#{build.short_code}</span>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 text-th-muted hover:text-[#FF6B00] transition-colors text-[11px]"
                title="Копировать ссылку на сборку"
              >
                {copied ? (
                  <><Check size={13} className="text-green-500" /><span className="text-green-500">Скопировано</span></>
                ) : (
                  <><Copy size={13} /><span>Копировать ссылку</span></>
                )}
              </button>
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
              +{build.components.length - 8} компонентов ещё
            </p>
          )}
        </div>
      )}

      {/* Footer: author + interactions */}
      <div className="px-5 py-3 border-t border-th-border flex items-center justify-between">
        {/* Author */}
        <div className="flex items-center gap-2.5">
          {build.author_avatar ? (
            <img
              src={build.author_avatar}
              alt={build.author_name}
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-th-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#FF6B00]/20 border border-[#FF6B00]/30 flex items-center justify-center text-xs font-bold text-[#FF6B00] shrink-0">
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

        {/* Interactions — bigger, more visible */}
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
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors cursor-pointer"
          >
            <Share2 size={17} />
          </div>
        </div>
      </div>
    </Link>
  )
}

export default BuildCard
