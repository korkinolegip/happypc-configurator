import React from 'react'
import type { StoreInfo } from '../types'

interface StoreBadgeProps {
  store: StoreInfo
  size?: 'sm' | 'md'
}

const StoreBadge: React.FC<StoreBadgeProps> = ({ store, size = 'sm' }) => {
  const iconSize = size === 'sm' ? 14 : 18
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const px = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 ${px} rounded ${textSize} font-bold whitespace-nowrap shrink-0 uppercase tracking-wide min-w-[3rem] justify-center`}
      style={{
        backgroundColor: store.color + '22',
        color: store.color,
        border: `1px solid ${store.color}44`,
      }}
    >
      {store.icon_url ? (
        <img
          src={store.icon_url}
          alt=""
          className="shrink-0 rounded-sm"
          style={{ width: iconSize, height: iconSize }}
        />
      ) : (
        <span
          className="shrink-0 rounded-full"
          style={{
            width: size === 'sm' ? 10 : 12,
            height: size === 'sm' ? 10 : 12,
            backgroundColor: store.color,
          }}
        />
      )}
      {store.short_label}
    </span>
  )
}

export default StoreBadge
