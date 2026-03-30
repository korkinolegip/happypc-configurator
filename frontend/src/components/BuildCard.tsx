import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ThumbsUp, MessageSquare, Eye, Share2 } from 'lucide-react'
import CategoryIcon from './CategoryIcon'
import ShareModal from './ShareModal'
import { toggleLike } from '../api/social'
import { useAuth } from '../hooks/useAuth'
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
  const { isAuthenticated } = useAuth()
  const [showShare, setShowShare] = useState(false)
  const [likesCount, setLikesCount] = useState(build.likes_count ?? 0)
  const [liked, setLiked] = useState(false)

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowShare(true)
  }

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      toast.error('Войдите, чтобы поставить лайк')
      return
    }
    try {
      const result = await toggleLike(build.id)
      setLiked(result.liked)
      setLikesCount(result.count)
    } catch {
      toast.error('Ошибка')
    }
  }

  const buildUrl = `${window.location.origin}/b/${build.short_code}`

  return (
    <>
      {showShare && <ShareModal url={buildUrl} onClose={() => setShowShare(false)} />}
      <Link
        to={`/b/${build.short_code}`}
        className="block bg-th-surface border border-th-border rounded-lg hover:border-[#FF6B00]/50 transition-all hover:shadow-th-lg"
      >
        {/* Header: title + date + price */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-th-text font-bold text-base sm:text-[17px] leading-snug line-clamp-2">
                {build.title || `Сборка ${build.short_code}`}
              </h3>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-th-text-3 text-xs">{formatDateTime(build.created_at)}</span>
                {build.tags && build.tags.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-th-border">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-th-border"
                      style={{ background: build.tags.includes('белый') ? '#ffffff' : '#222222' }}
                    />
                    <span className="text-th-text-2">{build.tags.includes('белый') ? 'Белая сборка' : 'Чёрная сборка'}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-baseline gap-2 shrink-0 pl-2 whitespace-nowrap">
              <span className="text-th-text-2 font-semibold text-base">Сумма:</span>
              <span className="text-[#FF6B00] font-bold text-xl">{formatPrice(build.total_price - (build.labor_cost || 0))} ₽</span>
            </div>
          </div>
        </div>

        {/* Components */}
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
              <p className="text-th-text-3 text-xs mt-2 pl-8">+{build.components.length - 8} ещё</p>
            )}
          </div>
        )}

        {/* Footer: author + interactions */}
        <div className="px-4 sm:px-5 py-3 border-t border-th-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {build.author_avatar ? (
              <img src={build.author_avatar} alt={build.author_name}
                className="w-8 h-8 sm:w-[38px] sm:h-[38px] rounded-full object-cover shrink-0 border border-th-border" />
            ) : (
              <div className="w-8 h-8 sm:w-[38px] sm:h-[38px] rounded-full bg-[#FF6B00]/20 border border-[#FF6B00]/30 flex items-center justify-center text-sm font-bold text-[#FF6B00] shrink-0">
                {build.author_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-th-text text-sm font-medium block leading-tight truncate">{build.author_name}</span>
              {build.workshop_name && (
                <span className="text-th-text-3 text-[11px] leading-tight truncate block">{build.workshop_name}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 bg-th-surface-2 rounded-lg px-0.5 sm:px-1 py-0.5 shrink-0">
            <div onClick={handleLike}
              className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-md transition-colors cursor-pointer ${
                liked ? 'text-[#FF6B00] bg-[#FF6B00]/10' : 'text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10'
              }`}>
              <ThumbsUp size={16} /><span className="text-xs sm:text-sm font-medium">{likesCount}</span>
            </div>
            <div className="w-px h-4 sm:h-5 bg-th-border" />
            <a
              href={`/b/${build.short_code}#comments`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-md text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors cursor-pointer"
            >
              <MessageSquare size={16} /><span className="text-xs sm:text-sm font-medium">{build.comments_count ?? 0}</span>
            </a>
            <div className="w-px h-4 sm:h-5 bg-th-border" />
            <div className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-md text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors cursor-pointer">
              <Eye size={16} /><span className="text-xs sm:text-sm font-medium">{build.views_count ?? 0}</span>
            </div>
            <div className="w-px h-4 sm:h-5 bg-th-border" />
            <div onClick={handleShare}
              className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-md text-th-text-2 hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 transition-colors cursor-pointer"
              title="Поделиться">
              <Share2 size={15} />
            </div>
          </div>
        </div>
      </Link>
    </>
  )
}

export default BuildCard
