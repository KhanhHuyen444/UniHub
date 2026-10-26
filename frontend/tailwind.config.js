/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'var(--unihub-brand)',
        navy: 'var(--unihub-navy)',
        cyan: 'var(--unihub-cyan)',
        page: 'var(--unihub-page)',
        surface: 'var(--unihub-surface)',
        ink: 'var(--unihub-text)',
        secondary: 'var(--unihub-text-secondary)',
        muted: 'var(--unihub-text-muted)',
        subtle: 'var(--unihub-text-subtle)',
        placeholder: 'var(--unihub-placeholder)',
        line: 'var(--unihub-border)',
        control: 'var(--unihub-control-border)',
        info: {
          DEFAULT: 'var(--unihub-info-text)',
          surface: 'var(--unihub-info-bg)',
        },
        success: {
          DEFAULT: 'var(--unihub-success-text)',
          surface: 'var(--unihub-success-bg)',
        },
        warning: {
          DEFAULT: 'var(--unihub-warning-text)',
          surface: 'var(--unihub-warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--unihub-error-text)',
          surface: 'var(--unihub-error-bg)',
          line: 'var(--unihub-error-border)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        public: 'var(--unihub-content-public)',
        student: 'var(--unihub-content-student)',
      },
      boxShadow: {
        soft: 'var(--unihub-shadow-soft)',
        nav: 'var(--unihub-shadow-nav-public)',
        button: 'var(--unihub-shadow-button)',
        'public-card': 'var(--unihub-shadow-card-public)',
      },
      borderRadius: {
        control: 'var(--unihub-radius-control)',
        compact: 'var(--unihub-radius-compact)',
        card: 'var(--unihub-radius-card)',
        pill: 'var(--unihub-radius-pill)',
      },
    },
  },
  plugins: [],
};
