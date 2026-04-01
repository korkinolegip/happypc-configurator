import React from 'react'
import {
  CPUIcon,
  GPUIcon,
  MotherboardIcon,
  RAMIcon,
  SSDIcon,
  HDDIcon,
  PSUIcon,
  CaseIcon,
  CoolingIcon,
  MonitorIcon,
  KeyboardIcon,
  MouseIcon,
  HeadphonesIcon,
  SpeakerIcon,
  WebcamIcon,
  PeripheryIcon,
  OtherIcon,
} from './icons/ComponentIcons'

interface CategoryIconProps {
  category: string
  size?: number
  color?: string
  className?: string
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 20, color = '#FF6B00', className }) => {
  const props = { size, color, className }

  switch (category) {
    case 'Процессор':
      return <CPUIcon {...props} />
    case 'Видеокарта':
      return <GPUIcon {...props} />
    case 'Материнская плата':
      return <MotherboardIcon {...props} />
    case 'Оперативная память':
      return <RAMIcon {...props} />
    case 'SSD':
      return <SSDIcon {...props} />
    case 'HDD':
      return <HDDIcon {...props} />
    case 'Блок питания':
      return <PSUIcon {...props} />
    case 'Корпус':
      return <CaseIcon {...props} />
    case 'Охлаждение':
    case 'Вентиляторы':
      return <CoolingIcon {...props} />
    case 'Монитор':
      return <MonitorIcon {...props} />
    case 'Клавиатура':
      return <KeyboardIcon {...props} />
    case 'Мышь':
      return <MouseIcon {...props} />
    case 'Наушники':
      return <HeadphonesIcon {...props} />
    case 'Колонки':
      return <SpeakerIcon {...props} />
    case 'Веб камера':
      return <WebcamIcon {...props} />
    case 'Периферия':
      return <PeripheryIcon {...props} />
    default:
      return <OtherIcon {...props} />
  }
}

export default CategoryIcon
