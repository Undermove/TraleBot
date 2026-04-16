export interface GeorgianDay {
  geo: string
  translit: string
  ru: string
  numberHint: string | null
}

// Index matches new Date().getDay(): 0=вс, 1=пн, 2=вт, 3=ср, 4=чт, 5=пт, 6=сб
export const GEORGIAN_DAYS: GeorgianDay[] = [
  {
    geo: 'კვირა',
    translit: 'kvi·ra',
    ru: 'воскресенье',
    numberHint: null,
  },
  {
    geo: 'ორშაბათი',
    translit: 'or·sha·ba·ti',
    ru: 'понедельник',
    numberHint: 'ორ — часть числа ორი (два)',
  },
  {
    geo: 'სამშაბათი',
    translit: 'sam·sha·ba·ti',
    ru: 'вторник',
    numberHint: 'სამ — часть числа სამი (три)',
  },
  {
    geo: 'ოთხშაბათი',
    translit: 'otkh·sha·ba·ti',
    ru: 'среда',
    numberHint: 'ოთხ — часть числа ოთხი (четыре)',
  },
  {
    geo: 'ხუთშაბათი',
    translit: 'khuth·sha·ba·ti',
    ru: 'четверг',
    numberHint: 'ხუთ — часть числა ხუთი (пять)',
  },
  {
    geo: 'პარასკევი',
    translit: 'pa·ras·ke·vi',
    ru: 'пятница',
    numberHint: null,
  },
  {
    geo: 'შაბათი',
    translit: 'sha·ba·ti',
    ru: 'суббота',
    numberHint: null,
  },
]

export function getTodayGeorgian(): GeorgianDay {
  return GEORGIAN_DAYS[new Date().getDay()]
}
