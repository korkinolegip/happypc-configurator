import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Filter, Link2, Cpu, Zap, FileText, Users, MessageCircle, MapPin, SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import BuildCard from '../components/BuildCard'
import { getBuilds, getPublicSettings, getPublicBuilds } from '../api/builds'
import { getWorkshops } from '../api/admin'
import { useAuth } from '../hooks/useAuth'
import type { BuildFilters } from '../api/builds'

// Guest landing
const GuestLanding: React.FC = () => (
  <div className="max-w-2xl mx-auto text-center py-8">
    <div className="flex justify-center mb-6">
      <div className="w-16 h-16 bg-[#FF6B00]/10 rounded-2xl flex items-center justify-center">
        <Cpu className="text-[#FF6B00]" size={36} />
      </div>
    </div>
    <h1 className="text-3xl font-bold text-white mb-3">Конфигуратор ПК</h1>
    <p className="text-[#AAAAAA] text-base mb-8 leading-relaxed">
      Создавайте сборки компьютеров, добавляйте ссылки из DNS, Ozon, Wildberries —
      название и цена заполнятся автоматически. Считайте итоговую стоимость включая работу.
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
      {[
        { icon: <Link2 size={20} />, text: 'Вставьте ссылку' },
        { icon: <Zap size={20} />, text: 'Автозаполнение' },
        { icon: <FileText size={20} />, text: 'Скачать PDF' },
        { icon: <Users size={20} />, text: 'Делитесь' },
      ].map(({ icon, text }) => (
        <div key={text} className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4 flex flex-col items-center gap-2">
          <span className="text-[#FF6B00]">{icon}</span>
          <span className="text-[#AAAAAA] text-xs">{text}</span>
        </div>
      ))}
    </div>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link to="/login" className="bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold px-8 py-3 rounded-lg transition-colors">
        Войти
      </Link>
      <Link to="/login" state={{ mode: 'register' }}
        className="bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] text-white font-semibold px-8 py-3 rounded-lg transition-colors">
        Зарегистрироваться
      </Link>
    </div>
  </div>
)

const POPULAR_TAGS = [
  'игровой', 'офисный', 'бюджетный', 'мощный', 'AMD', 'Intel', 'RTX', 'RX',
  'бесшумный', 'мини-ITX', 'рабочая станция', 'видеомонтаж', 'стриминг',
]

const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth()
  const [filters, setFilters] = useState<BuildFilters>({ sort: 'newest', page: 1, per_page: 20 })
  const [searchInput, setSearchInput] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: settings } = useQuery({ queryKey: ['settings-public'], queryFn: getPublicSettings, retry: false })
  const feedEnabled = settings?.public_feed_enabled !== 'false'

  const { data: buildsData, isLoading: buildsLoading } = useQuery({
    queryKey: ['builds', filters, isAuthenticated],
    queryFn: () => isAuthenticated ? getBuilds(filters) : getPublicBuilds(filters),
    enabled: feedEnabled || isAuthenticated,
    retry: false,
  })

  const { data: workshops } = useQuery({
    queryKey: ['workshops-list'], queryFn: getWorkshops, retry: false, enabled: isAuthenticated,
  })

  // Live search with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setFilters(f => ({ ...f, search: value || undefined, page: 1 }))
    }, 400)
  }, [])

  // Price filter apply
  const applyPriceFilter = useCallback(() => {
    setFilters(f => ({
      ...f,
      price_from: priceFrom ? Number(priceFrom) : undefined,
      price_to: priceTo ? Number(priceTo) : undefined,
      page: 1,
    }))
  }, [priceFrom, priceTo])

  // Tag click
  const handleTagClick = useCallback((tag: string) => {
    setFilters(f => ({ ...f, tag: f.tag === tag ? undefined : tag, page: 1 }))
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({ sort: 'newest', page: 1, per_page: 20 })
    setSearchInput('')
    setPriceFrom('')
    setPriceTo('')
  }, [])

  const hasActiveFilters = filters.search || filters.city || filters.workshop_id ||
    filters.price_from || filters.price_to || filters.tag || filters.author_id

  const totalPages = buildsData ? Math.ceil(buildsData.total / (filters.per_page || 20)) : 1

  // Get unique cities from builds
  const cities = buildsData?.items
    ? [...new Set(buildsData.items.map(b => b.city).filter(Boolean))]
    : []

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const isMaster = user?.role === 'master' || isAdmin

  if (!feedEnabled && !isAuthenticated) return <GuestLanding />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

      {/* ── LEFT: builds list ── */}
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Сборки ПК</h1>
            {buildsData && <p className="text-[#555555] text-sm mt-0.5">Найдено {buildsData.total}</p>}
          </div>
          {isAuthenticated && (
            <Link to="/builds/create"
              className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E05A00] text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm shrink-0 self-start">
              <Plus size={16} />Создать сборку
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 mb-4 space-y-2">
          {/* Row 1: Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input type="text" value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Поиск: название, мастер, комплектующие, цена, дата..."
                className="input-field pl-8 pr-8 text-sm" />
              {searchInput && (
                <button onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
            <select value={filters.sort || 'newest'}
              onChange={e => setFilters(f => ({ ...f, sort: e.target.value as BuildFilters['sort'], page: 1 }))}
              className="select-field text-sm min-w-[160px]">
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="price_asc">Цена ↑</option>
              <option value="price_desc">Цена ↓</option>
            </select>
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded text-sm transition-colors shrink-0 ${showAdvanced ? 'bg-[#FF6B00] text-white' : 'bg-[#2A2A2A] text-[#AAAAAA] hover:text-white'}`}>
              <SlidersHorizontal size={14} />Фильтры
              {hasActiveFilters && <span className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full" />}
            </button>
          </div>

          {/* Row 2: Advanced filters (collapsible) */}
          {showAdvanced && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#2A2A2A]">
              {/* City */}
              <div className="flex items-center gap-1.5 flex-1">
                <MapPin size={14} className="text-[#555] shrink-0" />
                <input type="text" value={filters.city || ''}
                  onChange={e => setFilters(f => ({ ...f, city: e.target.value || undefined, page: 1 }))}
                  placeholder="Город..."
                  className="input-field text-sm" />
              </div>

              {/* Price range */}
              <div className="flex items-center gap-1.5">
                <span className="text-[#555] text-xs shrink-0">₽</span>
                <input type="number" value={priceFrom}
                  onChange={e => setPriceFrom(e.target.value)}
                  onBlur={applyPriceFilter}
                  onKeyDown={e => e.key === 'Enter' && applyPriceFilter()}
                  placeholder="от"
                  className="input-field text-sm w-24" />
                <span className="text-[#555] text-xs">—</span>
                <input type="number" value={priceTo}
                  onChange={e => setPriceTo(e.target.value)}
                  onBlur={applyPriceFilter}
                  onKeyDown={e => e.key === 'Enter' && applyPriceFilter()}
                  placeholder="до"
                  className="input-field text-sm w-24" />
              </div>

              {/* Workshop */}
              {workshops && workshops.length > 0 && (
                <select value={filters.workshop_id || ''}
                  onChange={e => setFilters(f => ({ ...f, workshop_id: e.target.value || undefined, page: 1 }))}
                  className="select-field text-sm min-w-[150px]">
                  <option value="">Все мастерские</option>
                  {workshops.map(ws => <option key={ws.id} value={ws.id}>{ws.name} ({ws.city})</option>)}
                </select>
              )}

              {/* Clear */}
              {hasActiveFilters && (
                <button onClick={clearFilters}
                  className="text-[#FF6B00] text-sm hover:underline shrink-0">
                  Сбросить
                </button>
              )}
            </div>
          )}
        </div>

        {/* Build list */}
        {buildsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4 animate-pulse h-28" />
            ))}
          </div>
        ) : buildsData && buildsData.items.length > 0 ? (
          <>
            <div className="space-y-3">
              {buildsData.items.map(build => <BuildCard key={build.id} build={build} />)}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
                  disabled={!filters.page || filters.page <= 1}
                  className="px-3 py-1.5 bg-[#111111] border border-[#2A2A2A] text-[#AAAAAA] hover:text-white hover:border-[#FF6B00] rounded text-sm disabled:opacity-40"
                >← Назад</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const page = i + 1
                  const cur = filters.page || 1
                  if (totalPages > 7 && page > 2 && page < totalPages - 1 && Math.abs(page - cur) > 1) {
                    if (page === 3 || page === totalPages - 2) return <span key={page} className="text-[#AAAAAA] px-1">...</span>
                    return null
                  }
                  return (
                    <button key={page} onClick={() => setFilters(f => ({ ...f, page }))}
                      className={`w-8 h-8 rounded text-sm transition-colors ${cur === page ? 'bg-[#FF6B00] text-white' : 'bg-[#111111] border border-[#2A2A2A] text-[#AAAAAA] hover:text-white hover:border-[#FF6B00]'}`}>
                      {page}
                    </button>
                  )
                })}
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.min(totalPages, (f.page || 1) + 1) }))}
                  disabled={filters.page === totalPages}
                  className="px-3 py-1.5 bg-[#111111] border border-[#2A2A2A] text-[#AAAAAA] hover:text-white hover:border-[#FF6B00] rounded text-sm disabled:opacity-40"
                >Вперёд →</button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={40} className="text-[#2A2A2A] mb-4" />
            <p className="text-[#AAAAAA] mb-2">Сборки не найдены</p>
            <p className="text-[#555555] text-sm mb-5">
              {hasActiveFilters ? 'Попробуйте изменить фильтры' : 'Пока нет публичных сборок'}
            </p>
            {isAuthenticated && (
              <Link to="/builds/create"
                className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E05A00] text-white font-medium px-5 py-2.5 rounded-lg transition-colors">
                <Plus size={16} />Создать первую сборку
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: sidebar ── */}
      <div className="space-y-4 lg:sticky lg:top-4">

        {/* Create CTA */}
        {isAuthenticated && (
          <Link to="/builds/create"
            className="flex items-center justify-center gap-2 w-full bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold py-3 rounded-lg transition-colors">
            <Plus size={18} />Создать сборку
          </Link>
        )}
        {!isAuthenticated && (
          <Link to="/login"
            className="flex items-center justify-center gap-2 w-full bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold py-3 rounded-lg transition-colors">
            <Plus size={18} />Создать сборку
          </Link>
        )}

        {/* Support / contacts */}
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4">
          <h3 className="text-white font-semibold text-sm mb-3">Задать вопрос</h3>
          <p className="text-[#555555] text-xs mb-3">
            В наших чатах обсуждайте любые вопросы о подборе комплектующих и программах
          </p>
          <div className="space-y-2">
            <a href="#" onClick={e => e.preventDefault()}
               className="flex items-center gap-2 w-full py-2 px-3 rounded-lg text-sm text-white font-medium transition-colors"
               style={{ background: '#2ca5e0' }}>
              <MessageCircle size={15} />Чат в Telegram
            </a>
            <a href="#" onClick={e => e.preventDefault()}
               className="flex items-center gap-2 w-full py-2 px-3 rounded-lg text-sm text-white font-medium transition-colors"
               style={{ background: '#0077ff' }}>
              <MessageCircle size={15} />Чат в VK
            </a>
          </div>
        </div>

        {/* Popular tags */}
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4">
          <h3 className="text-white font-semibold text-sm mb-3">Популярные теги сборки</h3>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_TAGS.map(tag => (
              <span key={tag} onClick={() => handleTagClick(tag)}
                className={`px-2 py-0.5 border text-xs rounded-full cursor-pointer transition-colors ${
                  filters.tag === tag
                    ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-[#FF6B00]'
                    : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#888888] hover:border-[#FF6B00] hover:text-[#FF6B00]'
                }`}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        {buildsData && buildsData.total > 0 && (
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Статистика</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[#AAAAAA]">Всего сборок</span>
                <span className="text-white font-medium">{buildsData.total}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
