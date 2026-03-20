import React, { useState, useRef, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  Plus, Minus, Trash2, ChevronDown, ChevronUp, ExternalLink, Lock, Loader2, Eye, EyeOff,
} from 'lucide-react'
import CategoryIcon from './CategoryIcon'
import type { Build } from '../types'
import { parseProductUrl } from '../api/builds'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionItem {
  id?: string
  category: string
  name: string
  url: string
  price: string
  qty: string
}

export interface BuildFormValues {
  title: string
  description: string
  pc_items: SectionItem[]
  extra_items: SectionItem[]
  peri_items: SectionItem[]
  is_private: boolean          // true = доступ по ссылке (is_public = false)
  password: string
  labor_percent: string
  labor_price_manual: string
  budget: string
}

interface BuildFormProps {
  initialData?: Build
  onSubmit: (data: BuildFormValues) => Promise<void>
  isSubmitting: boolean
  submitLabel?: string
}

// ─── Sections definition ─────────────────────────────────────────────────────

const PC_SLOTS = [
  'Процессор', 'Материнская плата', 'Оперативная память',
  'Видеокарта', 'Охлаждение', 'SSD', 'Блок питания', 'Корпус', 'Вентиляторы',
]

const PERI_SLOTS = [
  'Монитор', 'Клавиатура', 'Мышь', 'Наушники', 'Операционная система',
]

const EXTRA_CATEGORIES = [
  'Процессор', 'Материнская плата', 'Оперативная память', 'Видеокарта',
  'Охлаждение', 'SSD', 'HDD', 'Блок питания', 'Корпус', 'Вентиляторы',
  'Монитор', 'Клавиатура', 'Мышь', 'Наушники', 'Операционная система',
  'Колонки', 'Веб камера', 'USB-хаб', 'Кабели', 'Другое',
]

const makeEmpty = (category: string): SectionItem => ({
  category, name: '', url: '', price: '', qty: '1',
})

// ─── Store detection & badge ──────────────────────────────────────────────────

const STORE_INFO: Record<string, { label: string; color: string; shortLabel: string }> = {
  wildberries: { label: 'Wildberries', color: '#CB11AB', shortLabel: 'WB' },
  dns:         { label: 'DNS',         color: '#F62A00', shortLabel: 'DNS' },
  ozon:        { label: 'Ozon',        color: '#005BFF', shortLabel: 'Ozon' },
  yandex:      { label: 'Яндекс Маркет', color: '#FFCC00', shortLabel: 'YM' },
  megamarket:  { label: 'МегаМаркет',  color: '#FF5C00', shortLabel: 'MM' },
  aliexpress:  { label: 'AliExpress',  color: '#FF6A00', shortLabel: 'Ali' },
  avito:       { label: 'Авито',       color: '#00AAFF', shortLabel: 'Avito' },
  citilink:    { label: 'Ситилинк',    color: '#FF8C00', shortLabel: 'CL' },
  mvideo:      { label: 'М.Видео',     color: '#FF0000', shortLabel: 'MV' },
  eldorado:    { label: 'Эльдорадо',   color: '#FFD700', shortLabel: 'EL' },
}

function detectStore(url: string): string | null {
  if (!url) return null
  const u = url.toLowerCase()
  if (u.includes('wildberries.ru') || u.includes('wb.ru')) return 'wildberries'
  if (u.includes('dns-shop.ru')) return 'dns'
  if (u.includes('ozon.ru')) return 'ozon'
  if (u.includes('megamarket.ru')) return 'megamarket'
  if (u.includes('aliexpress.ru') || u.includes('aliexpress.com')) return 'aliexpress'
  if (u.includes('market.yandex.ru') || u.includes('ya.cc')) return 'yandex'
  if (u.includes('avito.ru')) return 'avito'
  if (u.includes('citilink.ru')) return 'citilink'
  if (u.includes('mvideo.ru')) return 'mvideo'
  if (u.includes('eldorado.ru')) return 'eldorado'
  return null
}

function StoreBadge({ store }: { store: string }) {
  const info = STORE_INFO[store]
  if (!info) return null
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shrink-0 uppercase tracking-wide"
      style={{ backgroundColor: info.color + '22', color: info.color, border: `1px solid ${info.color}44` }}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
      {info.shortLabel}
    </span>
  )
}

export { STORE_INFO, detectStore, StoreBadge }

// ─── Single item row ──────────────────────────────────────────────────────────

interface ItemRowProps {
  fieldName: `pc_items.${number}` | `extra_items.${number}` | `peri_items.${number}`
  category: string
  canDelete?: boolean
  canChangeCategory?: boolean
  onDelete?: () => void
  onCategoryChange?: (cat: string) => void
  register: ReturnType<typeof useForm<BuildFormValues>>['register']
  setValue: ReturnType<typeof useForm<BuildFormValues>>['setValue']
  watch: ReturnType<typeof useForm<BuildFormValues>>['watch']
}

function ItemRow({ fieldName, category, canDelete, canChangeCategory, onDelete, onCategoryChange, register, setValue, watch }: ItemRowProps) {
  const [loading, setLoading] = useState(false)
  const [filled, setFilled] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentUrl = (watch(`${fieldName}.url` as never) as unknown as string) || ''
  const detectedStore = detectStore(currentUrl)

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setValue(`${fieldName}.url` as never, url as never)
    setFilled(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const store = detectStore(url)
    if (!store || !url.startsWith('http')) return
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const result = await parseProductUrl(url)
        if (result.name) { setValue(`${fieldName}.name` as never, result.name as never); setFilled(true) }
        if (result.price != null) setValue(`${fieldName}.price` as never, String(Math.round(result.price)) as never)
      } catch { /* silent */ } finally { setLoading(false) }
    }, 700)
  }, [fieldName, setValue])

  const currentQty = parseInt((watch(`${fieldName}.qty` as never) as unknown as string) || '1', 10) || 1

  return (
    <div className="flex gap-0 last:border-b-0" style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Left: icon + label */}
      <div className="w-[80px] shrink-0 flex flex-col items-center justify-center py-2 px-1" style={{ borderRight: '1px solid var(--border)' }}>
        <CategoryIcon category={category} size={36} />
        {canChangeCategory ? (
          <select
            value={category}
            onChange={e => onCategoryChange?.(e.target.value)}
            className="mt-1 w-full text-[9px] text-th-text-3 bg-transparent text-center cursor-pointer outline-none border-0 hover:text-[#FF6B00] transition-colors truncate"
          >
            {EXTRA_CATEGORIES.map(c => <option key={c} value={c} className="text-xs">{c}</option>)}
          </select>
        ) : (
          <span className="text-[10px] text-th-text-3 text-center mt-1 leading-tight break-words w-full">{category}</span>
        )}
      </div>

      {/* Right: two rows */}
      <div className="flex-1 min-w-0 py-1.5 px-2">
        {/* Row 1: name + price */}
        <div className="flex gap-1.5 mb-1">
          <input
            {...register(`${fieldName}.name` as never)}
            className="flex-1 min-w-0 bg-th-surface-3 border border-th-border rounded px-2 py-1.5 text-th-text text-sm placeholder-th-placeholder focus:outline-none focus:border-[#FF6B00] transition-colors"
            placeholder={`Введите название ${category.toLowerCase()}`}
          />
          <div className="relative shrink-0 w-28">
            <input
              {...register(`${fieldName}.price` as never)}
              type="number"
              min="0"
              step="1"
              className="w-full bg-th-surface-3 border border-th-border rounded pl-2 pr-6 py-1.5 text-th-text text-sm placeholder-th-placeholder focus:outline-none focus:border-[#FF6B00] transition-colors"
              placeholder="0"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-th-muted text-xs pointer-events-none">₽</span>
          </div>
        </div>
        {/* Row 2: URL + qty */}
        <div className="flex gap-1.5 items-center">
          <div className="relative flex-1 min-w-0">
            <input
              value={currentUrl}
              onChange={handleUrlChange}
              className="w-full bg-th-surface-3 border border-th-border rounded px-2 py-1.5 text-th-text text-sm placeholder-th-placeholder focus:outline-none focus:border-[#FF6B00] transition-colors"
              style={{ paddingRight: detectedStore ? '7rem' : '1.75rem' }}
              placeholder="Вставьте ссылку на товар"
              type="url"
              autoComplete="off"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {loading && <Loader2 size={12} className="text-[#FF6B00] animate-spin" />}
              {filled && !loading && <span className="text-green-500 text-[10px] font-bold">✓</span>}
              {detectedStore && !loading && <StoreBadge store={detectedStore} />}
              {currentUrl && !loading && (
                <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                   className="text-th-muted hover:text-[#FF6B00] transition-colors"
                   onClick={e => e.stopPropagation()}>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-0 rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => { if (currentQty > 1) setValue(`${fieldName}.qty` as never, String(currentQty - 1) as never) }}
              className="w-7 h-[30px] flex items-center justify-center transition-colors hover:text-[#FF6B00]"
              style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-2)' }}
            >
              <Minus size={12} />
            </button>
            <input
              {...register(`${fieldName}.qty` as never)}
              type="number"
              min="1"
              step="1"
              defaultValue="1"
              className="w-8 h-[30px] text-center text-sm outline-none border-x"
              style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
            />
            <button
              type="button"
              onClick={() => setValue(`${fieldName}.qty` as never, String(currentQty + 1) as never)}
              className="w-7 h-[30px] flex items-center justify-center transition-colors hover:text-[#FF6B00]"
              style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-2)' }}
            >
              <Plus size={12} />
            </button>
          </div>
          {canDelete && (
            <button type="button" onClick={onDelete}
              className="shrink-0 p-1 text-th-muted hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section accordion ────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  total: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, total, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
  return (
    <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-th-surface-2 transition-colors"
      >
        <span className="text-th-text font-semibold text-sm flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full" />
          {title}
        </span>
        <div className="flex items-center gap-3">
          {total > 0 && <span className="text-[#FF6B00] text-sm font-medium">{fmt(total)} ₽</span>}
          {open ? <ChevronUp size={16} className="text-th-text-2" /> : <ChevronDown size={16} className="text-th-text-2" />}
        </div>
      </button>
      {open && <div>{children}</div>}
      {open && total > 0 && (
        <div className="px-4 py-2 border-t border-th-border flex justify-end">
          <span className="text-th-text-2 text-xs">ИТОГО: <span className="text-th-text font-medium">{fmt(total)} ₽</span></span>
        </div>
      )}
    </div>
  )
}

// ─── Collapsible sidebar panel ────────────────────────────────────────────────

function SidePanel({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-th-surface-2 transition-colors"
      >
        <span className="text-th-text-2 text-sm">{title}</span>
        {open ? <ChevronUp size={14} className="text-th-muted shrink-0" /> : <ChevronDown size={14} className="text-th-muted shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionTotal(items: SectionItem[]): number {
  return items.reduce((sum, item) => {
    const p = parseFloat(item.price) || 0
    const q = parseFloat(item.qty) || 1
    return sum + p * q
  }, 0)
}

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

// ─── Main Component ───────────────────────────────────────────────────────────

const BuildForm: React.FC<BuildFormProps> = ({ initialData, onSubmit, isSubmitting, submitLabel = 'Сохранить' }) => {
  const [showPassword, setShowPassword] = useState(false)

  // Build default values
  const getDefaults = (): BuildFormValues => {
    if (!initialData) {
      return {
        title: '',
        description: '',
        pc_items: PC_SLOTS.map(makeEmpty),
        extra_items: [],
        peri_items: PERI_SLOTS.map(makeEmpty),
        is_private: false,
        password: '',
        labor_percent: '7',
        labor_price_manual: '',
        budget: '',
      }
    }
    // Map existing items into sections
    const pcMap: Record<string, SectionItem> = {}
    const periMap: Record<string, SectionItem> = {}
    const extras: SectionItem[] = []

    for (const item of initialData.items) {
      const si: SectionItem = { id: item.id, category: item.category, name: item.name, url: item.url || '', price: String(item.price), qty: '1' }
      if (PC_SLOTS.includes(item.category)) pcMap[item.category] = si
      else if (PERI_SLOTS.includes(item.category)) periMap[item.category] = si
      else extras.push(si)
    }

    return {
      title: initialData.title,
      description: initialData.description || '',
      pc_items: PC_SLOTS.map(cat => pcMap[cat] || makeEmpty(cat)),
      extra_items: extras,
      peri_items: PERI_SLOTS.map(cat => periMap[cat] || makeEmpty(cat)),
      is_private: !initialData.is_public,
      password: '',
      labor_percent: String(initialData.labor_percent),
      labor_price_manual: initialData.labor_price_manual != null ? String(initialData.labor_price_manual) : '',
      budget: '',
    }
  }

  const { register, control, handleSubmit, watch, setValue } = useForm<BuildFormValues>({ defaultValues: getDefaults() })

  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({ control, name: 'extra_items' })

  const watchedPc    = watch('pc_items')
  const watchedExtra = watch('extra_items')
  const watchedPeri  = watch('peri_items')
  const watchedLP    = watch('labor_percent')
  const watchedLM    = watch('labor_price_manual')
  const watchedBudget = watch('budget')
  const isPrivate    = watch('is_private')

  const pcTotal    = sectionTotal(watchedPc)
  const extraTotal = sectionTotal(watchedExtra)
  const periTotal  = sectionTotal(watchedPeri)
  const hardware   = pcTotal + extraTotal + periTotal

  const laborPercent = parseFloat(watchedLP) || 0
  const laborManual  = parseFloat(watchedLM) || 0
  const laborCost    = laborManual > 0 ? laborManual : Math.round(hardware * (laborPercent / 100))
  const grandTotal   = hardware + laborCost

  const budgetVal = parseFloat(watchedBudget) || 0
  const overBudget = budgetVal > 0 && grandTotal > budgetVal

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">

      {/* ── LEFT: sections + price ── */}
      <div>
        {/* PC Section */}
        <Section title="Персональный компьютер" total={pcTotal} defaultOpen>
          {PC_SLOTS.map((cat, i) => (
            <ItemRow
              key={cat}
              fieldName={`pc_items.${i}`}
              category={cat}
              canDelete={false}
              register={register}
              setValue={setValue}
              watch={watch}
            />
          ))}
        </Section>

        {/* Extra Section */}
        <Section title="Дополнительные комплектующие" total={extraTotal} defaultOpen={extraFields.length > 0}>
          {extraFields.map((field, i) => (
            <ItemRow
              key={field.id}
              fieldName={`extra_items.${i}`}
              category={watchedExtra[i]?.category || 'Другое'}
              canDelete
              canChangeCategory
              onDelete={() => removeExtra(i)}
              onCategoryChange={cat => setValue(`extra_items.${i}.category`, cat)}
              register={register}
              setValue={setValue}
              watch={watch}
            />
          ))}
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={() => appendExtra(makeEmpty('Другое'))}
              className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-th-border hover:border-[#FF6B00] text-th-text-2 hover:text-[#FF6B00] rounded transition-colors text-xs"
            >
              <Plus size={13} />
              Добавить позицию
            </button>
          </div>
        </Section>

        {/* Periphery Section */}
        <Section title="Периферийные устройства" total={periTotal} defaultOpen={false}>
          {PERI_SLOTS.map((cat, i) => (
            <ItemRow
              key={cat}
              fieldName={`peri_items.${i}`}
              category={cat}
              canDelete={false}
              register={register}
              setValue={setValue}
              watch={watch}
            />
          ))}
        </Section>

        {/* Labor + Total */}
        <div className="bg-th-surface border border-th-border rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-th-text-2 mb-1">Стоимость работы (%)</label>
              <input {...register('labor_percent', { min: 0, max: 100 })} type="number" min="0" max="100" step="0.5"
                className="input-field text-sm" placeholder="7" />
            </div>
            <div>
              <label className="block text-xs text-th-text-2 mb-1">Фикс. стоимость (₽) <span className="text-th-muted">(заменяет %)</span></label>
              <input {...register('labor_price_manual', { min: 0 })} type="number" min="0" step="1"
                className="input-field text-sm" placeholder="Пусто" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm"><span className="text-th-text-2">Железо</span><span className="text-th-text">{fmt(hardware)} ₽</span></div>
            <div className="flex justify-between text-sm"><span className="text-th-text-2">Работа {laborManual > 0 ? '(фикс.)' : `(${laborPercent}%)`}</span><span className="text-th-text">{fmt(laborCost)} ₽</span></div>
          </div>
          <div className={`mt-3 pt-3 border-t border-th-border flex justify-between items-center`}>
            <span className="text-th-text font-semibold">ИТОГО СБОРКИ:</span>
            <span className={`font-bold text-xl ${overBudget ? 'text-red-400' : 'text-[#FF6B00]'}`}>{fmt(grandTotal)} ₽</span>
          </div>
          {overBudget && (
            <p className="text-red-400 text-xs mt-1 text-right">Превышает бюджет на {fmt(grandTotal - budgetVal)} ₽</p>
          )}
        </div>
      </div>

      {/* ── RIGHT: sidebar ── */}
      <div className="space-y-2 xl:sticky xl:top-4">

        {/* Budget */}
        <SidePanel title="Установить бюджет сборки?">
          <div>
            <label className="block text-xs text-th-text-2 mb-1">Бюджет сборки</label>
            <div className="relative">
              <input {...register('budget')} type="number" min="0" step="1000"
                className="input-field text-sm pr-6" placeholder="0" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-th-muted text-xs pointer-events-none">₽</span>
            </div>
            {budgetVal > 0 && (
              <p className="text-xs mt-1" style={{ color: overBudget ? '#f87171' : '#22c55e' }}>
                {overBudget ? `Превышает на ${fmt(grandTotal - budgetVal)} ₽` : `Остаток: ${fmt(budgetVal - grandTotal)} ₽`}
              </p>
            )}
          </div>
        </SidePanel>

        {/* Build name + settings */}
        <SidePanel title="Назовём сборку, добавим комментарии и настроим?" defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-th-text-2 mb-1">Название сборки</label>
              <input {...register('title', { required: true })}
                className="input-field text-sm" placeholder="Название сборки" />
            </div>
            <div>
              <label className="block text-xs text-th-text-2 mb-1">Публичный комментарий</label>
              <textarea {...register('description')}
                className="input-field text-sm resize-none h-20" placeholder="Описание, особенности, назначение..." />
            </div>

            {/* Grand total preview */}
            {grandTotal > 0 && (
              <div className="bg-th-surface-3 border border-th-border rounded px-3 py-2 flex justify-between">
                <span className="text-th-text-2 text-xs">Итого</span>
                <span className={`text-sm font-bold ${overBudget ? 'text-red-400' : 'text-[#FF6B00]'}`}>{fmt(grandTotal)} ₽</span>
              </div>
            )}

            {/* Privacy toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className="relative">
                <input type="checkbox" {...register('is_private')} className="sr-only peer" />
                <div className="w-9 h-5 bg-th-surface-2 peer-checked:bg-[#FF6B00] rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
              </div>
              <div>
                <span className="text-sm text-th-text flex items-center gap-1">
                  {isPrivate ? <EyeOff size={13} /> : <Eye size={13} className="text-[#FF6B00]" />}
                  {isPrivate ? 'Доступ только по ссылке' : 'Публичная сборка'}
                </span>
              </div>
            </label>

            {isPrivate && (
              <div>
                <label className="block text-xs text-th-text-2 mb-1 flex items-center gap-1">
                  <Lock size={11} /> Пароль (необязательно)
                </label>
                <div className="relative">
                  <input {...register('password')} type={showPassword ? 'text' : 'password'}
                    className="input-field text-sm pr-9" placeholder="Оставьте пустым" />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-th-text-2 hover:text-th-text transition-colors">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </SidePanel>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#FF6B00] hover:bg-[#E05A00] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Сохранение...</>
          ) : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default BuildForm
