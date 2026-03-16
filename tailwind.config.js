/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        ink: '#121317',
        slate: '#4A5568',
        cloud: '#F7F6F2',
        ember: '#F97316',
        moss: '#1F7A5B',
        ocean: '#1B4B5A'
      },
      boxShadow: {
        'soft-xl': '0 20px 40px -24px rgba(18, 19, 23, 0.35)',
        'soft-lg': '0 12px 24px -14px rgba(18, 19, 23, 0.35)'
      }
    }
  },
  plugins: []
};
