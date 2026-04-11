/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dog: {
          bg: '#FFF6E5',
          accent: '#FF9B42',
          accent2: '#FFB86B',
          dark: '#1B1B2F',
          ink: '#2E2E3A',
          card: '#FFFFFF',
          muted: '#8A8A9A',
          line: '#F0E6D0',
          green: '#58CC02',
          red: '#E94F4F',
          blue: '#3AB8FF',
          gold: '#FFC800'
        }
      },
      fontFamily: {
        display: ['Nunito', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 4px 0 #E5D5B0',
        btn: '0 4px 0 #C87A2A',
        btngreen: '0 4px 0 #46A300',
        btnblue: '0 4px 0 #2A8FCC'
      }
    }
  },
  plugins: []
}
