import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			brand: {
  				'50': '#FFF7ED',
  				'100': '#FFEDD5',
  				'200': '#FED7AA',
  				'300': '#FDBA74',
  				'400': '#FB923C',
  				'500': '#F97316',
  				'600': '#EA580C',
  				'700': '#C2410C',
  				'800': '#9A3412',
  				'900': '#7C2D12'
  			},
  			petra: {
  				bg: '#F8FAFC',
  				card: '#FFFFFF',
  				sidebar: '#0F172A',
  				'sidebar-hover': '#1E293B',
  				'sidebar-active': '#F97316',
  				border: '#E2E8F0',
  				muted: '#64748B',
  				text: '#0F172A'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			xl: '0.75rem',
  			'2xl': '1rem',
  			'3xl': '1.5rem',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'Heebo',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'sans-serif'
  			]
  		},
  		boxShadow: {
  			card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
  			'card-hover': '0 8px 24px -4px rgba(0,0,0,0.10), 0 2px 8px -2px rgba(0,0,0,0.06)',
  			modal: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
  			'inner-sm': 'inset 0 1px 2px rgba(0,0,0,0.06)',
  			glow: '0 0 0 3px rgba(249,115,22,0.15)',
  		},
  		backgroundImage: {
  			'gradient-sidebar': 'linear-gradient(180deg, #0F172A 0%, #1A2744 100%)',
  			'gradient-brand': 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
  			'gradient-card': 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.2s ease-out',
  			'slide-up': 'slideUp 0.25s ease-out',
  			'scale-in': 'scaleIn 0.2s ease-out',
  			'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': { opacity: '0' },
  				'100%': { opacity: '1' },
  			},
  			slideUp: {
  				'0%': { opacity: '0', transform: 'translateY(8px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' },
  			},
  			scaleIn: {
  				'0%': { opacity: '0', transform: 'scale(0.96)' },
  				'100%': { opacity: '1', transform: 'scale(1)' },
  			},
  			pulseSoft: {
  				'0%, 100%': { opacity: '1' },
  				'50%': { opacity: '0.6' },
  			},
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
