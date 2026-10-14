// «Знакомство с буквой»: для каждой из 33 букв — простое русское слово на тот же звук и поверхность,
// которую стираешь пальцем, чтобы буква проявилась. Звучание и пояснения к трудным буквам — те же,
// что в теории уроков (MiniAppContentProvider.cs), без терминов.

export type Shape = 'dots' | 'speckle' | 'lines' | 'waves' | 'stripes' | 'vstripes' | 'arcs' | 'cross' | 'scales' | 'blobs' | 'fern' | 'bubbles' | 'drops' | 'grid' | 'swirl' | 'sparkle' | 'grooves'

export interface Layer { shape: Shape; colors: string[]; n?: number; size?: number; alpha?: number }

export interface Surface {
  /** Чем покрыта буква — рисуется на холсте и стирается пальцем. */
  cover: { base: string; layers: Layer[] }
  /** Что под покрытием (фон под буквой, CSS). */
  under: string
  /** Цвет буквы на этой поверхности. */
  ink: string
  /** Цвета крошек, которые летят при стирании. */
  crumbs: string[]
}

export interface LetterIntro {
  letter: string
  /** Звук для подписи: «а». */
  sound: string
  /** Русское слово на этот звук. */
  word: string
  /** Что делает палец: «Срежь корку». */
  action: string
  /** Одна строка про трудный звук — только где это нужно. */
  hint?: string
  surface: Surface
}

const INK = '#15100A'

export const INTROS: readonly LetterIntro[] = [
  { letter: 'ა', sound: 'а', word: 'арбуз', action: 'Срежь корку арбуза',
    surface: { cover: { base: '#3E7A2E', layers: [{ shape: 'vstripes', colors: ['#1F4F18'], n: 7, size: 16 }, { shape: 'speckle', colors: ['#6FA04A'], n: 260, size: 2 }] }, under: 'radial-gradient(circle at 50% 40%, #FF5C6E, #E01A3C 70%)', ink: INK, crumbs: ['#3E7A2E', '#1F4F18', '#9BCB6B'] } },
  { letter: 'დ', sound: 'д', word: 'дождь', action: 'Протри стекло от капель',
    surface: { cover: { base: '#B9C7D3', layers: [{ shape: 'drops', colors: ['#E6EEF5', '#8EA3B5'], n: 70, size: 9 }] }, under: 'linear-gradient(180deg, #3A5A7A, #1E3550)', ink: '#FDFAEF', crumbs: ['#E6EEF5', '#B9C7D3'] } },
  { letter: 'რ', sound: 'р', word: 'река', action: 'Разгони воду ладонью',
    surface: { cover: { base: '#3A7FCC', layers: [{ shape: 'waves', colors: ['#C9DBF0', '#1B5FB0'], n: 16, size: 3 }] }, under: 'linear-gradient(180deg, #E8D3A6, #CDB07A)', ink: '#0E3F7D', crumbs: ['#C9DBF0', '#3A7FCC', '#FFFFFF'] } },
  { letter: 'ე', sound: 'э', word: 'эскимо', action: 'Откуси шоколадную глазурь', hint: 'ე — всегда «э», даже там, где по-русски пишут «е»',
    surface: { cover: { base: '#5A3420', layers: [{ shape: 'swirl', colors: ['#7A4A2C'], n: 9, size: 3 }, { shape: 'sparkle', colors: ['#A8734D'], n: 30, size: 3 }] }, under: 'linear-gradient(180deg, #FFFDF6, #F3E9D2)', ink: '#5A3420', crumbs: ['#5A3420', '#7A4A2C'] } },
  { letter: 'ი', sound: 'и', word: 'ириска', action: 'Разверни ириску',
    surface: { cover: { base: '#F4E6C2', layers: [{ shape: 'stripes', colors: ['#E01A3C'], n: 9, size: 10 }, { shape: 'sparkle', colors: ['#FFFFFF'], n: 24, size: 3 }] }, under: 'radial-gradient(circle at 40% 35%, #E8A65A, #B86E25 75%)', ink: '#FDFAEF', crumbs: ['#E01A3C', '#F4E6C2'] } },
  { letter: 'ს', sound: 'с', word: 'снег', action: 'Смахни снег',
    surface: { cover: { base: '#F4F8FC', layers: [{ shape: 'blobs', colors: ['#FFFFFF', '#E1EAF3'], n: 40, size: 26 }, { shape: 'sparkle', colors: ['#BFD3EA'], n: 50, size: 2 }] }, under: 'linear-gradient(180deg, #2F6B45, #1D4A2E)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#E1EAF3'] } },
  { letter: 'ვ', sound: 'в', word: 'вата', action: 'Распуши сладкую вату',
    surface: { cover: { base: '#F7C6D6', layers: [{ shape: 'blobs', colors: ['#FBDCE6', '#F2A9C1'], n: 55, size: 24 }] }, under: 'linear-gradient(180deg, #FDFAEF, #F5EFE0)', ink: '#E01A3C', crumbs: ['#F7C6D6', '#FBDCE6'] } },
  { letter: 'მ', sound: 'м', word: 'мороз', action: 'Сотри иней со стекла',
    surface: { cover: { base: '#DDEBF5', layers: [{ shape: 'fern', colors: ['#FFFFFF', '#B8D0E6'], n: 14, size: 60 }, { shape: 'sparkle', colors: ['#FFFFFF'], n: 40, size: 2 }] }, under: 'linear-gradient(180deg, #0E3F7D, #1B5FB0)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#DDEBF5'] } },
  { letter: 'ნ', sound: 'н', word: 'нитки', action: 'Распутай нитки',
    surface: { cover: { base: '#F5EFE0', layers: [{ shape: 'cross', colors: ['#E01A3C', '#1B5FB0', '#F5B820'], n: 70, size: 90 }] }, under: 'linear-gradient(180deg, #FDFAEF, #F5EFE0)', ink: '#1B5FB0', crumbs: ['#E01A3C', '#1B5FB0', '#F5B820'] } },
  { letter: 'ლ', sound: 'л', word: 'лёд', action: 'Растопи лёд пальцем',
    surface: { cover: { base: '#BFE3F0', layers: [{ shape: 'cross', colors: ['#FFFFFF', '#8CC6DC'], n: 22, size: 70 }, { shape: 'sparkle', colors: ['#FFFFFF'], n: 30, size: 3 }] }, under: 'linear-gradient(180deg, #0E3F7D, #08294F)', ink: '#BFE3F0', crumbs: ['#FFFFFF', '#BFE3F0'] } },
  { letter: 'ჩ', sound: 'ч', word: 'черника', action: 'Собери чернику', hint: '«ч» с лёгким выдохом',
    surface: { cover: { base: '#3F3A78', layers: [{ shape: 'bubbles', colors: ['#5B55A8', '#2B275A'], n: 70, size: 13 }] }, under: 'linear-gradient(180deg, #F7E7C4, #EBD2A0)', ink: '#3F3A78', crumbs: ['#5B55A8', '#3F3A78'] } },
  { letter: 'ხ', sound: 'х', word: 'хлеб', action: 'Стряхни муку с хлеба',
    surface: { cover: { base: '#F3EEE4', layers: [{ shape: 'speckle', colors: ['#FFFFFF', '#E3D9C6'], n: 600, size: 3 }] }, under: 'radial-gradient(circle at 50% 40%, #D99844, #9C5E22 80%)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#F3EEE4'] } },
  { letter: 'თ', sound: 'т', word: 'тесто', action: 'Раскатай тесто', hint: '«т» с выдохом, будто задуваешь спичку',
    surface: { cover: { base: '#F2DFB8', layers: [{ shape: 'bubbles', colors: ['#E6CC98'], n: 30, size: 7 }, { shape: 'speckle', colors: ['#FFFFFF'], n: 200, size: 2 }] }, under: 'repeating-linear-gradient(90deg, #C78B4E 0 22px, #B57A3F 22px 26px)', ink: '#FDFAEF', crumbs: ['#F2DFB8', '#FFFFFF'] } },
  { letter: 'ო', sound: 'о', word: 'облако', action: 'Разгони облака',
    surface: { cover: { base: '#EEF3F8', layers: [{ shape: 'blobs', colors: ['#FFFFFF', '#D9E4EF'], n: 30, size: 40 }] }, under: 'linear-gradient(180deg, #6FA8E6, #3A7FCC)', ink: '#F5B820', crumbs: ['#FFFFFF', '#D9E4EF'] } },
  { letter: 'შ', sound: 'ш', word: 'шоколад', action: 'Сними фольгу с шоколадки',
    surface: { cover: { base: '#E9C25A', layers: [{ shape: 'cross', colors: ['#FFF0B8', '#C68F10'], n: 26, size: 60 }] }, under: 'repeating-linear-gradient(0deg, #5A3420 0 46px, #3E2214 46px 50px), #5A3420', ink: '#FCD76D', crumbs: ['#FCD76D', '#C68F10'] } },
  { letter: 'ბ', sound: 'б', word: 'берёза', action: 'Погладь берёзовую кору',
    surface: { cover: { base: '#F4F1EA', layers: [{ shape: 'lines', colors: ['#2A2520'], n: 26, size: 22 }] }, under: 'linear-gradient(180deg, #7FAE4E, #4E7F2C)', ink: '#FDFAEF', crumbs: ['#F4F1EA', '#2A2520'] } },
  { letter: 'გ', sound: 'г', word: 'газета', action: 'Протри газету',
    surface: { cover: { base: '#E9E4D8', layers: [{ shape: 'grid', colors: ['#9A9385'], n: 22, size: 2 }] }, under: 'linear-gradient(180deg, #FDFAEF, #F5EFE0)', ink: '#E01A3C', crumbs: ['#E9E4D8', '#9A9385'] } },
  { letter: 'ქ', sound: 'к', word: 'кофе', action: 'Размешай пенку', hint: '«к» с выдохом: поднеси ладонь ко рту — она почувствует воздух',
    surface: { cover: { base: '#E8D2B0', layers: [{ shape: 'swirl', colors: ['#C9A57A', '#FFF4E2'], n: 8, size: 4 }] }, under: 'radial-gradient(circle, #6B3E1F, #3A1F0E 80%)', ink: '#F5E3C6', crumbs: ['#E8D2B0', '#FFF4E2'] } },
  { letter: 'კ', sound: 'к', word: 'камень', action: 'Счисти мох с камня', hint: '«к» коротко, без выдоха — пара к ქ',
    surface: { cover: { base: '#5E8A3A', layers: [{ shape: 'blobs', colors: ['#78A64B', '#4A7230'], n: 50, size: 18 }] }, under: 'radial-gradient(circle at 40% 35%, #B0ABA2, #7C776E 80%)', ink: INK, crumbs: ['#78A64B', '#5E8A3A'] } },
  { letter: 'ც', sound: 'ц', word: 'цветы', action: 'Раздвинь лепестки', hint: '«ц» с выдохом',
    surface: { cover: { base: '#F7D4DB', layers: [{ shape: 'blobs', colors: ['#F0506C', '#FCD76D', '#FFFFFF'], n: 60, size: 14 }] }, under: 'linear-gradient(180deg, #7FAE4E, #4E7F2C)', ink: '#FDFAEF', crumbs: ['#F0506C', '#FCD76D', '#FFFFFF'] } },
  { letter: 'წ', sound: 'ц', word: 'цирк', action: 'Открой шатёр цирка', hint: '«ц» коротко и резко — пара к ც',
    surface: { cover: { base: '#FDFAEF', layers: [{ shape: 'vstripes', colors: ['#E01A3C'], n: 8, size: 20 }] }, under: 'radial-gradient(circle, #FCD76D, #F5B820 75%)', ink: '#A61026', crumbs: ['#E01A3C', '#FDFAEF'] } },
  { letter: 'ტ', sound: 'т', word: 'торт', action: 'Слижи глазурь с торта', hint: '«т» коротко, без выдоха — пара к თ',
    surface: { cover: { base: '#F7B9CB', layers: [{ shape: 'dots', colors: ['#1B5FB0', '#F5B820', '#FFFFFF', '#E01A3C'], n: 70, size: 3 }] }, under: 'linear-gradient(180deg, #FCE7A6, #F2CC6B)', ink: '#E01A3C', crumbs: ['#F7B9CB', '#FFFFFF'] } },
  { letter: 'უ', sound: 'у', word: 'уголь', action: 'Раздуй угли',
    surface: { cover: { base: '#2A2724', layers: [{ shape: 'blobs', colors: ['#3A3632', '#1C1A18'], n: 40, size: 20 }] }, under: 'radial-gradient(circle, #FFB347, #E0531A 75%)', ink: '#FCD76D', crumbs: ['#3A3632', '#E0531A'] } },
  { letter: 'ფ', sound: 'п', word: 'пена', action: 'Сдуй мыльную пену', hint: '«п» с выдохом; там, где по-русски «ф» («фото»), — тоже ფ',
    surface: { cover: { base: '#F2F7FB', layers: [{ shape: 'bubbles', colors: ['#FFFFFF', '#CFE3F2', '#E9D7F2'], n: 60, size: 16 }] }, under: 'repeating-linear-gradient(45deg, #3A7FCC 0 18px, #1B5FB0 18px 36px)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#CFE3F2'] } },
  { letter: 'პ', sound: 'п', word: 'песок', action: 'Разгреби песок', hint: '«п» коротко, без выдоха — пара к ფ',
    surface: { cover: { base: '#E6C98E', layers: [{ shape: 'speckle', colors: ['#D4B271', '#F3DEB0', '#B89354'], n: 700, size: 2 }] }, under: 'linear-gradient(180deg, #3A7FCC, #1B5FB0)', ink: '#FDFAEF', crumbs: ['#E6C98E', '#D4B271'] } },
  { letter: 'ღ', sound: 'г', word: 'гнездо', action: 'Раздвинь веточки', hint: 'мягкое «г» горлом, похоже на картавое «р»',
    surface: { cover: { base: '#A0703F', layers: [{ shape: 'cross', colors: ['#6E4723', '#C89A62'], n: 60, size: 50 }] }, under: 'radial-gradient(circle, #DCEFF7, #A7D3E6 80%)', ink: '#6E4723', crumbs: ['#A0703F', '#6E4723'] } },
  { letter: 'ძ', sound: 'дз', word: 'дзюдо', action: 'Протри татами', hint: '«дз» слитно, одним звуком',
    surface: { cover: { base: '#C9C27A', layers: [{ shape: 'grid', colors: ['#A39C55'], n: 26, size: 3 }] }, under: 'linear-gradient(180deg, #1B5FB0, #0E3F7D)', ink: '#FDFAEF', crumbs: ['#C9C27A', '#A39C55'] } },
  { letter: 'ზ', sound: 'з', word: 'золото', action: 'Отполируй золото',
    surface: { cover: { base: '#C68F10', layers: [{ shape: 'sparkle', colors: ['#FCD76D', '#FFF4C2'], n: 70, size: 4 }, { shape: 'speckle', colors: ['#A87A0C'], n: 200, size: 2 }] }, under: 'linear-gradient(180deg, #FCD76D, #F5B820)', ink: '#0E3F7D', crumbs: ['#FCD76D', '#FFF4C2'] } },
  { letter: 'ყ', sound: 'к', word: 'кора', action: 'Сними кору с полена', hint: '«к» глубоко в горле. Не выходит — читай как «к», тебя поймут',
    surface: { cover: { base: '#7A5232', layers: [{ shape: 'grooves', colors: ['#4F3420', '#9C6E46'], n: 18, size: 3 }] }, under: 'radial-gradient(circle, #F2DDB6, #E1C08A 80%)', ink: '#5A3420', crumbs: ['#7A5232', '#4F3420'] } },
  { letter: 'ჭ', sound: 'ч', word: 'чешуя', action: 'Счисти чешую', hint: '«ч» коротко и резко — пара к ჩ',
    surface: { cover: { base: '#A9C3D6', layers: [{ shape: 'scales', colors: ['#D6E5F0', '#7E9DB5'], n: 0, size: 18 }] }, under: 'linear-gradient(180deg, #F7D4DB, #F0A7B5)', ink: '#A61026', crumbs: ['#D6E5F0', '#A9C3D6'] } },
  { letter: 'ჟ', sound: 'ж', word: 'желе', action: 'Покачай желе',
    surface: { cover: { base: '#7CC46A', layers: [{ shape: 'bubbles', colors: ['#A7DC94', '#5DA64A'], n: 30, size: 10 }, { shape: 'sparkle', colors: ['#E8FFE0'], n: 20, size: 4 }] }, under: 'linear-gradient(180deg, #FDFAEF, #F5EFE0)', ink: '#2F7A22', crumbs: ['#7CC46A', '#A7DC94'] } },
  { letter: 'ჯ', sound: 'дж', word: 'джем', action: 'Намажь джем пальцем', hint: 'одна буква на звук «дж»',
    surface: { cover: { base: '#C21A3A', layers: [{ shape: 'dots', colors: ['#F5D06A'], n: 60, size: 2 }, { shape: 'sparkle', colors: ['#FF8FA3'], n: 20, size: 4 }] }, under: 'radial-gradient(circle, #F4D29A, #D99844 80%)', ink: '#A61026', crumbs: ['#C21A3A', '#FF8FA3'] } },
  { letter: 'ჰ', sound: 'х', word: 'хвоя', action: 'Стряхни хвою со снега', hint: 'лёгкое «х» — едва слышный выдох',
    surface: { cover: { base: '#2F6B45', layers: [{ shape: 'lines', colors: ['#4E9A63', '#1D4A2E'], n: 160, size: 12 }] }, under: 'linear-gradient(180deg, #FFFFFF, #E1EAF3)', ink: '#2F6B45', crumbs: ['#4E9A63', '#2F6B45'] } }
]

export const introOf = (letter: string) => INTROS.find(i => i.letter === letter)

/** «აрбуз»: первая буква слова уже грузинская. Для «дз»/«дж» заменяем обе русские буквы. */
export function wordWithLetter(i: LetterIntro): string {
  return i.letter + i.word.slice(i.sound.length)
}
