import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(240 15% 8%)',
        foreground: 'hsl(210 40% 98%)',
        card: 'hsl(240 16% 12%)',
        'card-foreground': 'hsl(210 40% 98%)',
        popover: 'hsl(240 16% 12%)',
        'popover-foreground': 'hsl(210 40% 98%)',
        primary: 'hsl(263 70% 66%)',
        'primary-foreground': 'hsl(210 40% 98%)',
        secondary: 'hsl(240 10% 18%)',
        'secondary-foreground': 'hsl(210 40% 98%)',
        muted: 'hsl(240 10% 18%)',
        'muted-foreground': 'hsl(240 5% 70%)',
        accent: 'hsl(281 65% 70%)',
        'accent-foreground': 'hsl(240 15% 8%)',
        border: 'hsl(240 10% 22%)',
        input: 'hsl(240 10% 18%)',
        ring: 'hsl(263 70% 66%)',
        success: 'hsl(142 72% 45%)',
        warning: 'hsl(38 92% 55%)',
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.05), 0 12px 40px rgba(120, 84, 255, 0.22)',
      },
      backgroundImage: {
        'avatar-grid': 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
      },
    },
  },
  plugins: [],
} satisfies Config
