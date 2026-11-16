// "Tour broadcast" theme.
//
// The pages were written with stock Tailwind colors (gray, slate, blue,
// emerald, ...). Rather than touch every page, those names are remapped here
// to the theme's palette:
//   - gray and slate  -> one crisp neutral ramp (they used to differ slightly)
//   - blue, emerald   -> tour green (blue was the old "primary" color)
//   - fairway         -> tour green (the brand color)
//   - indigo, purple, sky -> neutral, teal -> tour green
//   - flag            -> the lime highlight used for live / active states
// New code should prefer `tour`, `ink`, and `flag`.

const ink = {
  50: '#F7F7F6',
  100: '#EFEFED',
  200: '#E3E3E0',
  300: '#CFCFCB',
  400: '#A3A39E',
  500: '#74746F',
  600: '#55554F',
  700: '#3D3D39',
  800: '#262624',
  900: '#141413',
  950: '#0A0A0A',
}

const tour = {
  50: '#EEF6F1',
  100: '#D5EADD',
  200: '#A9D3B9',
  300: '#74B68F',
  400: '#3F9166',
  500: '#1F7A4D',
  600: '#146B43',
  700: '#0F5537',
  800: '#0B3D2E',
  900: '#072A20',
  950: '#041A14',
}

const flag = {
  50: '#FAFDE8',
  100: '#F3FAC4',
  200: '#E9F693',
  300: '#DDF46E',
  400: '#D4F25A',
  500: '#BFE03A',
  600: '#9BBB1F',
  700: '#748C17',
  800: '#566816',
  900: '#3D4A12',
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink,
        tour,
        flag,
        gray: ink,
        slate: ink,
        blue: tour,
        emerald: tour,
        fairway: tour,
        teal: tour,
        indigo: ink,
        purple: ink,
        sky: ink,
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
      // Squarer corners and flatter surfaces than Tailwind's defaults.
      borderRadius: {
        DEFAULT: '3px',
        md: '4px',
        lg: '5px',
        xl: '6px',
        '2xl': '8px',
      },
      boxShadow: {
        sm: '0 1px 0 rgb(10 10 10 / 0.04)',
        DEFAULT: '0 1px 2px rgb(10 10 10 / 0.06)',
        md: '0 1px 3px rgb(10 10 10 / 0.08)',
      },
    },
  },
  plugins: [],
}
