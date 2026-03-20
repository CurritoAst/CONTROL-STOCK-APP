/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            colors: {
                bg: {
                    primary: '#09090b',   /* Zinc-950 */
                    secondary: '#18181b', /* Zinc-900 */
                    elevated: '#27272a'   /* Zinc-800 */
                },
                text: {
                    primary: '#ffffff',
                    secondary: '#e4e4e7', /* Zinc-200 */
                    muted: '#a1a1aa'      /* Zinc-400 */
                },
                accent: {
                    blue: {
                        DEFAULT: '#4f46e5', /* Indigo-600 */
                        hover: '#4338ca'    /* Indigo-700 */
                    },
                    green: {
                        DEFAULT: '#10b981', /* Emerald-500 */
                        hover: '#059669'
                    },
                    red: {
                        DEFAULT: '#ef4444',
                        hover: '#dc2626'
                    }
                },
                glass: {
                    bg: 'rgba(24, 24, 27, 0.85)', /* Solid elevated base with slight trancparency */
                    border: 'rgba(255, 255, 255, 0.08)',
                }
            },
            boxShadow: {
                'corporate': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
                'corporate-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
                'glow': '0 0 15px rgba(79, 70, 229, 0.3)'
            },
            backdropBlur: {
                'corporate': '16px'
            }
        },
    },
    plugins: [],
}
