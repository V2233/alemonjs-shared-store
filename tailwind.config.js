/**
 *  @type {import('tailwindcss').Config}
 */
export default {
  content: ['./web/**/*.{jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        xs: '320px', // 比 sm 小一半的尺寸
      },
    },
  },
};
