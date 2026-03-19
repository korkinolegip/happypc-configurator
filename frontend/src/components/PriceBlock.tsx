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
    <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#2A2A2A]">
        <span className="text-[#AAAAAA] text-sm">Стоимость железа</span>
        <span className="text-white font-medium">{fmt(hardwareTotal)}</span>
      </div>

      <div className="px-4 py-3 flex items-center justify-between border-b border-[#2A2A2A]">
        <span className="text-[#AAAAAA] text-sm">
          Стоимость работы{' '}
          <span className="text-xs">
            {isFixed ? '(фикс.)' : `(${laborPercent}%)`}
          </span>
        </span>
        <span className="text-white font-medium">{fmt(laborCost)}</span>
      </div>

      <div className="px-4 py-4 flex items-center justify-between bg-[#1A1A1A]">
        <span className="text-white font-semibold text-sm">Цена «под ключ»</span>
        <span className="text-[#FF6B00] font-bold text-xl">{fmt(totalPrice)}</span>
      </div>
    </div>
  )
}

export default PriceBlock
