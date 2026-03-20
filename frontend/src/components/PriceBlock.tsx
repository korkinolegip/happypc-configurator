import React from 'react'

interface PriceBlockProps {
  hardwareTotal: number
  totalPrice: number       // hardware + labor
  laborCost: number
  laborPercent: number
  laborPriceManual?: number | null
}

const fmt = (price: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(price)

const PriceBlock: React.FC<PriceBlockProps> = ({
  hardwareTotal,
  totalPrice,
  laborCost,
  laborPercent,
  laborPriceManual,
}) => {
  const isFixed = laborPriceManual != null && laborPriceManual > 0

  return (
    <div className="bg-th-surface border border-th-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-th-border">
        <span className="text-th-text-2 text-sm">Стоимость комплектующих</span>
        <span className="text-th-text font-medium">{fmt(hardwareTotal)}</span>
      </div>

      <div className="px-4 py-3 flex items-center justify-between border-b border-th-border">
        <span className="text-th-text-2 text-sm">
          Стоимость работы{' '}
          <span className="text-xs">
            {isFixed ? '(фикс.)' : `(${laborPercent}%)`}
          </span>
        </span>
        <span className="text-th-text font-medium">{fmt(laborCost)}</span>
      </div>

      <div className="px-4 py-4 flex items-center justify-between bg-th-surface-2">
        <span className="text-th-text font-semibold text-sm">Цена «под ключ»</span>
        <span className="text-[#FF6B00] font-bold text-xl">{fmt(totalPrice)}</span>
      </div>
    </div>
  )
}

export default PriceBlock
