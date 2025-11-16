/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VSCode color palette
        vscode: {
          // Dark theme
          'editor-bg': '#1e1e1e',
          'sidebar-bg': '#252526',
          'titlebar-bg': '#323233',
          'statusbar-bg': '#007acc',
          'panel-bg': '#1e1e1e',
          'menu-bg': '#252526', // 菜单和弹窗背景色
          'input-bg': '#3c3c3c',
          'input-border': '#3c3c3c',
          'selection-bg': '#264f78',
          'accent': '#007acc',
          'accent-hover': '#1f8ad1',
          'foreground': '#cccccc',
          'foreground-dim': '#858585',
          'border': '#454545',

          // Light theme
          'light-editor-bg': '#ffffff',
          'light-sidebar-bg': '#f3f3f3',
          'light-titlebar-bg': '#dddddd',
          'light-statusbar-bg': '#007acc',
          'light-panel-bg': '#f3f3f3',
          'light-menu-bg': '#f3f3f3', // 浅色主题菜单和弹窗背景色
          'light-input-bg': '#ffffff',
          'light-input-border': '#cecece',
          'light-selection-bg': '#add6ff',
          'light-accent': '#005fb8',
          'light-accent-hover': '#0078d4',
          'light-foreground': '#383a42',
          'light-foreground-dim': '#6a737d',
          'light-border': '#e5e5e5',
        }
      },
      fontFamily: {
        'mono': ['Consolas', 'Monaco', 'Courier New', 'monospace'],
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xs': '11px',
        'sm': '12px',
        'base': '13px',
        'lg': '14px',
        'xl': '16px',
      },
      spacing: {
        '4.5': '1.125rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
