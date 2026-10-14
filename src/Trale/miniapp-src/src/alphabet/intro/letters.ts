import { cyr } from '../../verbs/types'

// «Знакомство с буквой»: для каждой из 33 букв — грузинское слово, которое с неё начинается, и поверхность
// по этому слову, которую стираешь пальцем, чтобы буква проявилась (ს — საზამთრო, «срежь корку арбуза»).
// Остальные буквы слова ученик ещё не знает — и не должен: подсвечена та, чей звук он слышит.
// Каждое слово и его значение сверены со словарём — ссылка рядом с записью (intro.test.tsx проверяет,
// что ссылка есть). Звучание и пояснения к трудным буквам — те же, что в теории уроков, без терминов.

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
  /** Звук для подписи: «с». */
  sound: string
  /** Грузинское слово, которое начинается с этой буквы: საზამთრო. */
  word: string
  /** Что это слово значит по-русски: «арбуз». */
  ru: string
  /** Что делает палец — по тому же слову: «Срежь корку арбуза». */
  action: string
  /** Одна строка про трудный звук — только где это нужно. */
  hint?: string
  /** Где сверено слово и его значение. */
  source: string
  surface: Surface
}

const INK = '#15100A'
const WIKI = 'https://en.wiktionary.org/wiki/'

export const INTROS: readonly LetterIntro[] = [
  // https://en.wiktionary.org/wiki/ატამი — peach
  { letter: 'ა', sound: 'а', word: 'ატამი', ru: 'персик', action: 'Сотри пушок с персика', source: WIKI + 'ატამი',
    surface: { cover: { base: '#F4A46C', layers: [{ shape: 'blobs', colors: ['#EE8455', '#F7B884'], n: 26, size: 34 }, { shape: 'speckle', colors: ['#FFE1C2', '#FFD3A8'], n: 700, size: 2 }] }, under: 'radial-gradient(circle at 50% 45%, #FFD27F, #F29A3A 80%)', ink: '#7A2E0C', crumbs: ['#FFE1C2', '#F4A46C'] } },
  // https://en.wiktionary.org/wiki/დათვი — bear
  { letter: 'დ', sound: 'д', word: 'დათვი', ru: 'медведь', action: 'Расчеши шерсть медведя', source: WIKI + 'დათვი',
    surface: { cover: { base: '#7A4E2D', layers: [{ shape: 'lines', colors: ['#5C3820', '#9A6A42', '#6B4326'], n: 420, size: 12 }] }, under: 'radial-gradient(circle at 50% 45%, #F2DDB6, #D9B784 80%)', ink: '#4A2C17', crumbs: ['#7A4E2D', '#9A6A42'] } },
  // https://en.wiktionary.org/wiki/რძე — milk
  { letter: 'რ', sound: 'р', word: 'რძე', ru: 'молоко', action: 'Сдуй пенку с молока', source: WIKI + 'რძე',
    surface: { cover: { base: '#FFFDF6', layers: [{ shape: 'bubbles', colors: ['#FFFFFF', '#F1EADB'], n: 70, size: 14 }] }, under: 'linear-gradient(180deg, #E9F1F8, #C9DBF0)', ink: '#1B5FB0', crumbs: ['#FFFFFF', '#F1EADB'] } },
  // https://en.wiktionary.org/wiki/ელვა — lightning
  { letter: 'ე', sound: 'э', word: 'ელვა', ru: 'молния', action: 'Разгони грозовые тучи', hint: 'ე — всегда «э», даже там, где по-русски пишут «е»', source: WIKI + 'ელვა',
    surface: { cover: { base: '#4A5363', layers: [{ shape: 'blobs', colors: ['#5E6878', '#363D4A', '#6C7686'], n: 40, size: 30 }] }, under: 'linear-gradient(180deg, #1E2A44, #0E1628)', ink: '#FCD76D', crumbs: ['#5E6878', '#363D4A'] } },
  // https://en.wiktionary.org/wiki/ია — violet (flower)
  { letter: 'ი', sound: 'и', word: 'ია', ru: 'фиалка', action: 'Раздвинь листья фиалки', source: WIKI + 'ია',
    surface: { cover: { base: '#4E7F2C', layers: [{ shape: 'blobs', colors: ['#6FA04A', '#3A6420', '#5E8A3A'], n: 50, size: 20 }] }, under: 'radial-gradient(circle at 50% 45%, #C7AEEA, #7A55B8 80%)', ink: '#FDFAEF', crumbs: ['#6FA04A', '#3A6420'] } },
  // https://en.wiktionary.org/wiki/საზამთრო — watermelon
  { letter: 'ს', sound: 'с', word: 'საზამთრო', ru: 'арбуз', action: 'Срежь корку арбуза', source: WIKI + 'საზამთრო',
    surface: { cover: { base: '#3E7A2E', layers: [{ shape: 'vstripes', colors: ['#1F4F18'], n: 7, size: 16 }, { shape: 'speckle', colors: ['#6FA04A'], n: 260, size: 2 }] }, under: 'radial-gradient(circle at 50% 40%, #FF5C6E, #E01A3C 70%)', ink: INK, crumbs: ['#3E7A2E', '#1F4F18', '#9BCB6B'] } },
  // https://en.wiktionary.org/wiki/ვაშლი — apple
  { letter: 'ვ', sound: 'в', word: 'ვაშლი', ru: 'яблоко', action: 'Срежь кожуру с яблока', source: WIKI + 'ვაშლი',
    surface: { cover: { base: '#D8283C', layers: [{ shape: 'vstripes', colors: ['#B81E30'], n: 10, size: 6 }, { shape: 'speckle', colors: ['#F2C14E'], n: 140, size: 2 }] }, under: 'radial-gradient(circle at 50% 45%, #FFF6D8, #F3DFA0 80%)', ink: '#A61026', crumbs: ['#D8283C', '#F3DFA0'] } },
  // https://en.wiktionary.org/wiki/მზე — Sun
  { letter: 'მ', sound: 'м', word: 'მზე', ru: 'солнце', action: 'Разгони облака — за ними солнце', source: WIKI + 'მზე',
    surface: { cover: { base: '#EEF3F8', layers: [{ shape: 'blobs', colors: ['#FFFFFF', '#D9E4EF'], n: 30, size: 40 }] }, under: 'radial-gradient(circle at 50% 45%, #FFE27A, #F5B820 75%)', ink: '#A61026', crumbs: ['#FFFFFF', '#D9E4EF'] } },
  // https://en.wiktionary.org/wiki/ნაყინი — ice cream
  { letter: 'ნ', sound: 'н', word: 'ნაყინი', ru: 'мороженое', action: 'Откуси глазурь с мороженого', source: WIKI + 'ნაყინი',
    surface: { cover: { base: '#5A3420', layers: [{ shape: 'swirl', colors: ['#7A4A2C'], n: 9, size: 3 }, { shape: 'sparkle', colors: ['#A8734D'], n: 30, size: 3 }] }, under: 'linear-gradient(180deg, #FFFDF6, #F3E9D2)', ink: '#5A3420', crumbs: ['#5A3420', '#7A4A2C'] } },
  // https://en.wiktionary.org/wiki/ლიმონი — lemon
  { letter: 'ლ', sound: 'л', word: 'ლიმონი', ru: 'лимон', action: 'Сними кожуру с лимона', source: WIKI + 'ლიმონი',
    surface: { cover: { base: '#F5D02A', layers: [{ shape: 'speckle', colors: ['#E3B90F', '#FFF08A'], n: 500, size: 2 }] }, under: 'radial-gradient(circle at 50% 45%, #FFF9D2, #F8E27A 80%)', ink: '#7A5A00', crumbs: ['#F5D02A', '#FFF08A'] } },
  // https://en.wiktionary.org/wiki/ჩაი — tea
  { letter: 'ჩ', sound: 'ч', word: 'ჩაი', ru: 'чай', action: 'Сдуй пар с чашки чая', hint: '«ч» с лёгким выдохом', source: WIKI + 'ჩაი',
    surface: { cover: { base: '#E6E9ED', layers: [{ shape: 'blobs', colors: ['#FFFFFF', '#D5DBE2'], n: 36, size: 30 }] }, under: 'radial-gradient(circle at 50% 45%, #C9772E, #7A3A10 80%)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#D5DBE2'] } },
  // https://en.wiktionary.org/wiki/ხაჭაპური — khachapuri, cheese bread
  { letter: 'ხ', sound: 'х', word: 'ხაჭაპური', ru: 'хачапури', action: 'Разломай корочку хачапури', source: WIKI + 'ხაჭაპური',
    surface: { cover: { base: '#D99844', layers: [{ shape: 'blobs', colors: ['#C47E30', '#E6AE5E'], n: 30, size: 22 }, { shape: 'speckle', colors: ['#B5722A', '#F0C07A'], n: 260, size: 3 }] }, under: 'radial-gradient(circle at 50% 45%, #FFE07A, #F5B820 80%)', ink: '#7A3A08', crumbs: ['#D99844', '#F0C07A'] } },
  // https://en.wiktionary.org/wiki/თოვლი — snow
  { letter: 'თ', sound: 'т', word: 'თოვლი', ru: 'снег', action: 'Смахни снег', hint: '«т» с выдохом, будто задуваешь спичку', source: WIKI + 'თოვლი',
    surface: { cover: { base: '#F4F8FC', layers: [{ shape: 'blobs', colors: ['#FFFFFF', '#E1EAF3'], n: 40, size: 26 }, { shape: 'sparkle', colors: ['#BFD3EA'], n: 50, size: 2 }] }, under: 'linear-gradient(180deg, #2F6B45, #1D4A2E)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#E1EAF3'] } },
  // https://en.wiktionary.org/wiki/ოქრო — gold
  { letter: 'ო', sound: 'о', word: 'ოქრო', ru: 'золото', action: 'Отполируй золото', source: WIKI + 'ოქრო',
    surface: { cover: { base: '#C68F10', layers: [{ shape: 'sparkle', colors: ['#FCD76D', '#FFF4C2'], n: 70, size: 4 }, { shape: 'speckle', colors: ['#A87A0C'], n: 200, size: 2 }] }, under: 'linear-gradient(180deg, #FCD76D, #F5B820)', ink: '#0E3F7D', crumbs: ['#FCD76D', '#FFF4C2'] } },
  // https://en.wiktionary.org/wiki/შაქარი — sugar
  { letter: 'შ', sound: 'ш', word: 'შაქარი', ru: 'сахар', action: 'Стряхни сахар со стола', source: WIKI + 'შაქარი',
    surface: { cover: { base: '#FAFAF7', layers: [{ shape: 'speckle', colors: ['#FFFFFF', '#E6E2D8'], n: 800, size: 3 }, { shape: 'sparkle', colors: ['#FFFFFF'], n: 40, size: 3 }] }, under: 'linear-gradient(180deg, #7A4A2C, #5A3420)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#E6E2D8'] } },
  // https://en.wiktionary.org/wiki/ბადრიჯანი — aubergine, eggplant
  { letter: 'ბ', sound: 'б', word: 'ბადრიჯანი', ru: 'баклажан', action: 'Очисти баклажан от кожуры', source: WIKI + 'ბადრიჯანი',
    surface: { cover: { base: '#4B2A5E', layers: [{ shape: 'vstripes', colors: ['#3A1F4A'], n: 6, size: 10 }, { shape: 'sparkle', colors: ['#7D5A94'], n: 30, size: 4 }] }, under: 'radial-gradient(circle at 50% 45%, #F4EBC6, #DCCB8F 80%)', ink: '#4B2A5E', crumbs: ['#4B2A5E', '#7D5A94'] } },
  // https://en.wiktionary.org/wiki/გოგრა — pumpkin
  { letter: 'გ', sound: 'г', word: 'გოგრა', ru: 'тыква', action: 'Срежь кожуру с тыквы', source: WIKI + 'გოგრა',
    surface: { cover: { base: '#E8781E', layers: [{ shape: 'vstripes', colors: ['#C85E10'], n: 8, size: 10 }, { shape: 'speckle', colors: ['#F59A45'], n: 200, size: 2 }] }, under: 'radial-gradient(circle at 50% 45%, #FFC46B, #F59A2E 80%)', ink: '#7A3A08', crumbs: ['#E8781E', '#C85E10'] } },
  // https://en.wiktionary.org/wiki/ქვა — stone
  { letter: 'ქ', sound: 'к', word: 'ქვა', ru: 'камень', action: 'Счисти мох с камня', hint: '«к» с выдохом: поднеси ладонь ко рту — она почувствует воздух', source: WIKI + 'ქვა',
    surface: { cover: { base: '#5E8A3A', layers: [{ shape: 'blobs', colors: ['#78A64B', '#4A7230'], n: 50, size: 18 }] }, under: 'radial-gradient(circle at 40% 35%, #B0ABA2, #7C776E 80%)', ink: INK, crumbs: ['#78A64B', '#5E8A3A'] } },
  // https://en.wiktionary.org/wiki/კატა — cat
  { letter: 'კ', sound: 'к', word: 'კატა', ru: 'кошка', action: 'Погладь кошку', hint: '«к» коротко, без выдоха — пара к ქ', source: WIKI + 'კატა',
    surface: { cover: { base: '#9A9A9A', layers: [{ shape: 'vstripes', colors: ['#7A7A7A'], n: 9, size: 8 }, { shape: 'lines', colors: ['#6E6E6E', '#C4C4C4'], n: 380, size: 11 }] }, under: 'radial-gradient(circle at 50% 45%, #FBE3E8, #F0A7B5 85%)', ink: '#3A3A3A', crumbs: ['#9A9A9A', '#C4C4C4'] } },
  // https://en.wiktionary.org/wiki/ცომი — dough
  { letter: 'ც', sound: 'ц', word: 'ცომი', ru: 'тесто', action: 'Раскатай тесто', hint: '«ц» с выдохом', source: WIKI + 'ცომი',
    surface: { cover: { base: '#F2DFB8', layers: [{ shape: 'bubbles', colors: ['#E6CC98'], n: 30, size: 7 }, { shape: 'speckle', colors: ['#FFFFFF'], n: 200, size: 2 }] }, under: 'repeating-linear-gradient(90deg, #C78B4E 0 22px, #B57A3F 22px 26px)', ink: '#FDFAEF', crumbs: ['#F2DFB8', '#FFFFFF'] } },
  // https://en.wiktionary.org/wiki/წყალი — water
  { letter: 'წ', sound: 'ц', word: 'წყალი', ru: 'вода', action: 'Разгони воду ладонью', hint: '«ц» коротко и резко — пара к ც', source: WIKI + 'წყალი',
    surface: { cover: { base: '#3A7FCC', layers: [{ shape: 'waves', colors: ['#C9DBF0', '#1B5FB0'], n: 16, size: 3 }] }, under: 'linear-gradient(180deg, #E8D3A6, #CDB07A)', ink: '#0E3F7D', crumbs: ['#C9DBF0', '#3A7FCC', '#FFFFFF'] } },
  // https://en.wiktionary.org/wiki/ტყე — forest
  { letter: 'ტ', sound: 'т', word: 'ტყე', ru: 'лес', action: 'Раздвинь ветки в лесу', hint: '«т» коротко, без выдоха — пара к თ', source: WIKI + 'ტყე',
    surface: { cover: { base: '#2F6B45', layers: [{ shape: 'cross', colors: ['#1D4A2E', '#4E9A63'], n: 60, size: 50 }, { shape: 'blobs', colors: ['#3E8556'], n: 30, size: 12 }] }, under: 'linear-gradient(180deg, #D7EDC2, #9CCB84)', ink: '#1D4A2E', crumbs: ['#4E9A63', '#2F6B45'] } },
  // https://en.wiktionary.org/wiki/ულვაში — moustache
  { letter: 'უ', sound: 'у', word: 'ულვაში', ru: 'усы', action: 'Расчеши усы', source: WIKI + 'ულვაში',
    surface: { cover: { base: '#5A3A22', layers: [{ shape: 'lines', colors: ['#3E2614', '#7A5232'], n: 260, size: 22 }] }, under: 'radial-gradient(circle at 50% 45%, #F7D9B8, #E8B98A 85%)', ink: '#3E2614', crumbs: ['#5A3A22', '#7A5232'] } },
  // https://en.wiktionary.org/wiki/ფოთოლი — leaf
  { letter: 'ფ', sound: 'п', word: 'ფოთოლი', ru: 'лист', action: 'Сгреби опавшие листья', hint: '«п» с выдохом; там, где по-русски «ф» («фото»), — тоже ფ', source: WIKI + 'ფოთოლი',
    surface: { cover: { base: '#D9822B', layers: [{ shape: 'blobs', colors: ['#E8A33A', '#B5531A', '#C9A23A'], n: 60, size: 16 }] }, under: 'linear-gradient(180deg, #7FAE4E, #4E7F2C)', ink: '#FDFAEF', crumbs: ['#E8A33A', '#B5531A', '#C9A23A'] } },
  // https://en.wiktionary.org/wiki/პური — bread
  { letter: 'პ', sound: 'п', word: 'პური', ru: 'хлеб', action: 'Стряхни муку с хлеба', hint: '«п» коротко, без выдоха — пара к ფ', source: WIKI + 'პური',
    surface: { cover: { base: '#F3EEE4', layers: [{ shape: 'speckle', colors: ['#FFFFFF', '#E3D9C6'], n: 600, size: 3 }] }, under: 'radial-gradient(circle at 50% 40%, #D99844, #9C5E22 80%)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#F3EEE4'] } },
  // https://en.wiktionary.org/wiki/ღვინო — wine
  { letter: 'ღ', sound: 'г', word: 'ღვინო', ru: 'вино', action: 'Сотри пыль с бутылки вина', hint: 'мягкое «г» горлом, похоже на картавое «р»', source: WIKI + 'ღვინო',
    surface: { cover: { base: '#B7AE9C', layers: [{ shape: 'speckle', colors: ['#CFC7B5', '#9C937F'], n: 600, size: 3 }] }, under: 'radial-gradient(circle at 50% 45%, #9C1B3A, #5A0A1E 80%)', ink: '#FDFAEF', crumbs: ['#CFC7B5', '#B7AE9C'] } },
  // https://en.wiktionary.org/wiki/ძაღლი — dog
  { letter: 'ძ', sound: 'дз', word: 'ძაღლი', ru: 'собака', action: 'Погладь собаку', hint: '«дз» слитно, одним звуком', source: WIKI + 'ძაღლი',
    surface: { cover: { base: '#C98A4B', layers: [{ shape: 'blobs', colors: ['#8A5A2B', '#F2DDB6'], n: 16, size: 26 }, { shape: 'lines', colors: ['#B07A3E', '#DDA668'], n: 300, size: 10 }] }, under: 'linear-gradient(180deg, #FDFAEF, #F5EFE0)', ink: '#6E4723', crumbs: ['#C98A4B', '#8A5A2B'] } },
  // https://en.wiktionary.org/wiki/ზღარბი — hedgehog
  { letter: 'ზ', sound: 'з', word: 'ზღარბი', ru: 'ёж', action: 'Погладь ежа по колючкам', source: WIKI + 'ზღარბი',
    surface: { cover: { base: '#6B5A48', layers: [{ shape: 'lines', colors: ['#3E3226', '#A89580', '#2A2119'], n: 420, size: 13 }] }, under: 'radial-gradient(circle at 50% 45%, #E8D3B0, #C9AE84 80%)', ink: '#3E3226', crumbs: ['#6B5A48', '#A89580'] } },
  // https://en.wiktionary.org/wiki/ყავა — coffee
  { letter: 'ყ', sound: 'к', word: 'ყავა', ru: 'кофе', action: 'Размешай пенку на кофе', hint: '«к» глубоко в горле. Не выходит — читай как «к», тебя поймут', source: WIKI + 'ყავა',
    surface: { cover: { base: '#E8D2B0', layers: [{ shape: 'swirl', colors: ['#C9A57A', '#FFF4E2'], n: 8, size: 4 }] }, under: 'radial-gradient(circle, #6B3E1F, #3A1F0E 80%)', ink: '#F5E3C6', crumbs: ['#E8D2B0', '#FFF4E2'] } },
  // https://en.wiktionary.org/wiki/ჭიქა — glass, cup
  { letter: 'ჭ', sound: 'ч', word: 'ჭიქა', ru: 'стакан', action: 'Протри запотевший стакан', hint: '«ч» коротко и резко — пара к ჩ', source: WIKI + 'ჭიქა',
    surface: { cover: { base: '#B9C7D3', layers: [{ shape: 'drops', colors: ['#E6EEF5', '#8EA3B5'], n: 70, size: 9 }] }, under: 'linear-gradient(180deg, #DCEBF7, #9CC2E4)', ink: '#0E3F7D', crumbs: ['#E6EEF5', '#B9C7D3'] } },
  // https://en.wiktionary.org/wiki/ჟირაფი — giraffe
  { letter: 'ჟ', sound: 'ж', word: 'ჟირაფი', ru: 'жираф', action: 'Сотри пятна с жирафа', source: WIKI + 'ჟირაფი',
    surface: { cover: { base: '#F2C14E', layers: [{ shape: 'blobs', colors: ['#A8642A', '#8A4E1F'], n: 34, size: 20 }] }, under: 'linear-gradient(180deg, #BFDDF5, #6FA8E6)', ink: '#8A4E1F', crumbs: ['#A8642A', '#F2C14E'] } },
  // https://en.wiktionary.org/wiki/ჯინსი — jeans
  { letter: 'ჯ', sound: 'дж', word: 'ჯინსი', ru: 'джинсы', action: 'Отряхни джинсы', hint: 'одна буква на звук «дж»', source: WIKI + 'ჯინსი',
    surface: { cover: { base: '#3A5F99', layers: [{ shape: 'grid', colors: ['#2C4A7A'], n: 40, size: 2 }, { shape: 'speckle', colors: ['#6F8FC0'], n: 300, size: 2 }] }, under: 'linear-gradient(180deg, #FDFAEF, #F5EFE0)', ink: '#2C4A7A', crumbs: ['#3A5F99', '#6F8FC0'] } },
  // https://en.wiktionary.org/wiki/ჰაერი — air
  { letter: 'ჰ', sound: 'х', word: 'ჰაერი', ru: 'воздух', action: 'Лопни пузыри — выпусти воздух', hint: 'лёгкое «х» — едва слышный выдох', source: WIKI + 'ჰაერი',
    surface: { cover: { base: '#F2F7FB', layers: [{ shape: 'bubbles', colors: ['#FFFFFF', '#CFE3F2', '#E9D7F2'], n: 60, size: 16 }] }, under: 'linear-gradient(180deg, #BFDDF5, #3A7FCC)', ink: '#FDFAEF', crumbs: ['#FFFFFF', '#CFE3F2'] } }
]

export const introOf = (letter: string) => INTROS.find(i => i.letter === letter)

/** Как слово звучит — кириллицей, как везде в мини-аппе: «сазамтро». */
export const transcriptionOf = (i: LetterIntro) => cyr(i.word)

/** Слово по буквам с пометкой, где новая буква — чтобы подсветить её в подписи. */
export const wordParts = (i: LetterIntro) => [...i.word].map(ch => ({ ch, own: ch === i.letter }))

/**
 * Записи букв (их грузинские названия: ანი, ბანი…) в public/audio/alphabet. Имена файлов — латиницей,
 * это только адреса, ученик их не видит.
 */
const AUDIO_FILE: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 'th', ი: 'i', კ: 'k', ლ: 'l',
  მ: 'm', ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'f', ქ: 'q',
  ღ: 'gh', ყ: 'ky', შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'tsw', ჭ: 'tch', ხ: 'kh', ჯ: 'j', ჰ: 'h'
}

export const letterAudio = (letter: string): string | null => (AUDIO_FILE[letter] ? `/audio/alphabet/${AUDIO_FILE[letter]}.m4a` : null)
