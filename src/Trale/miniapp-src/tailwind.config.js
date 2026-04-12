/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ══════ Minanka palette (active — Georgian enamel jewels) ══════
        cream: {
          DEFAULT: '#FBF6EC',
          deep: '#F5EFE0',
          tile: '#FDFAEF',
          edge: '#E8DEC5'
        },
        jewelInk: {
          DEFAULT: '#15100A',
          soft: '#3A2B1F',
          mid: '#5A4735',
          hint: '#7A6B52',
          faint: '#B5A68B'
        },
        navy: {
          DEFAULT: '#1B5FB0',
          deep: '#0E3F7D',
          light: '#3A7FCC',
          wash: '#C9DBF0'
        },
        ruby: {
          DEFAULT: '#E01A3C',
          deep: '#A61026',
          light: '#F0506C',
          wash: '#F7D4DB'
        },
        gold: {
          DEFAULT: '#F5B820',
          deep: '#C68F10',
          light: '#FCD76D',
          wash: '#F9EAC1'
        },

        // ══════ Picture Book palette (legacy, kept alongside) ══════
        peach: {
          50: '#FDF6EA',
          100: '#FBEAD6',
          200: '#F6D9B6',
          300: '#EFC598',
          400: '#E6AE78'
        },
        warm: {
          900: '#2A1F18',
          800: '#3B2D23',
          700: '#5A4735',
          600: '#7A6654',
          500: '#9E8670',
          400: '#B5A28A'
        },
        coral: {
          50: '#FDEEE6',
          100: '#FBD9CC',
          200: '#F6B49E',
          400: '#EC8369',
          500: '#E86B4E',
          600: '#D4563B',
          700: '#A8432C'
        },
        ochre: {
          500: '#D99844',
          600: '#B87B2F'
        },
        sage: {
          100: '#E7EED9',
          300: '#C1D0A5',
          500: '#9BAE7B',
          700: '#6F8454'
        },

        // ══════ Legacy sketchbook tokens (kept so non-redesigned screens still render) ══════
        paper: {
          DEFAULT: '#FBEAD6',
          light: '#FDF6EA',
          dark: '#F6D9B6',
          edge: '#EFC598',
          shade: '#E6AE78'
        },
        // Ink — warm near-black, used for text and line art
        ink: {
          DEFAULT: '#1A1612',
          soft: '#3B2F25',
          faint: '#6B5A48',
          hint: '#9B8870'
        },
        // Wine — Georgian ceramic red, primary accent
        wine: {
          DEFAULT: '#A03A2C',
          deep: '#7A2A20',
          light: '#C25747',
          wash: '#E8C9C4'
        },
        // Moss — secondary accent
        moss: {
          DEFAULT: '#4A6B3A',
          deep: '#35502A',
          light: '#6B8E55',
          wash: '#CFDAC2'
        },
        // Saffron — highlight gold
        saffron: {
          DEFAULT: '#C9923A',
          deep: '#A37626',
          light: '#E0B055',
          wash: '#F0E1BD'
        },
        // Sky — Tbilisi sky, tertiary
        sky: {
          DEFAULT: '#7A9CB8',
          deep: '#5B7A94',
          light: '#A3BDD1',
          wash: '#D3E0EB'
        }
      },
      fontFamily: {
        sans: ['Manrope', 'Noto Sans Georgian', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Noto Sans Georgian', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'Noto Sans Georgian', '-apple-system', 'system-ui', 'sans-serif'],
        hand: ['Fraunces', 'cursive'],
        geo: ['Noto Sans Georgian', 'Noto Serif Georgian', 'Manrope', 'sans-serif']
      },
      boxShadow: {
        paper: '0 1px 0 rgba(26,22,18,0.08), 0 2px 10px rgba(26,22,18,0.04)',
        card: '2px 3px 0 rgba(26,22,18,0.08), 0 4px 16px rgba(26,22,18,0.05)',
        deep: '4px 6px 0 rgba(26,22,18,0.1), 0 8px 28px rgba(26,22,18,0.08)',
        stamp: 'inset 0 0 0 2px currentColor',
        inset: 'inset 0 1px 2px rgba(26,22,18,0.12)'
      },
      borderRadius: {
        sketch: '1px',
        card: '4px',
        pill: '999px'
      },
      letterSpacing: {
        grand: '0.12em'
      }
    }
  },
  plugins: []
}
