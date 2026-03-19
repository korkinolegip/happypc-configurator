import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Filter, Link2, Cpu, Zap, FileText, Users, MessageCircle } from 'lucide-react'
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
  const { isAuthenticated } = useAuth()
  const [filters, setFilters] = useState<BuildFilters>({ sort: 'newest', page: 1, per_page: 20 })
  const [authorSearch, setAuthorSearch] = useState('')

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

  const handleAuthorSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters(f => ({ ...f, author: authorSearch, page: 1 }))
  }

  const totalPages = buildsData ? Math.ceil(buildsData.total / (filters.per_page || 20)) : 1

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
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <form onSubmit={handleAuthorSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" />
                <input type="text" value={authorSearch} onChange={e => setAuthorSearch(e.target.value)}
                  placeholder="Поиск по автору..."
                  className="input-field pl-8 text-sm" />
              </div>
              <button type="submit"
                className="bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white px-3 py-2 rounded text-sm transition-colors">
                Найти
              </button>
            </form>
            {workshops && workshops.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-[#AAAAAA] shrink-0" />
                <select value={filters.workshop_id || ''}
                  onChange={e => setFilters(f => ({ ...f, workshop_id: e.target.value || undefined, page: 1 }))}
                  className="select-field text-sm min-w-[150px]">
                  <option value="">Все мастерские</option>
                  {workshops.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                </select>
              </div>
            )}
            <select value={filters.sort || 'newest'}
              onChange={e => setFilters(f => ({ ...f, sort: e.target.value as 'newest' | 'oldest', page: 1 }))}
              className="select-field text-sm min-w-[140px]">
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
            </select>
          </div>
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
              {filters.author || filters.workshop_id ? 'Попробуйте изменить фильтры' : 'Пока нет публичных сборок'}
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
              <span key={tag}
                className="px-2 py-0.5 bg-[#1A1A1A] border border-[#2A2A2A] text-[#888888] text-xs rounded-full hover:border-[#FF6B00] hover:text-[#FF6B00] cursor-pointer transition-colors">
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
