import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label="Toggle Theme"
      className="p-2.5 rounded-full transition-all duration-300 border bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200 dark:bg-[#130b2c]/80 dark:text-amber-300 dark:hover:bg-purple-900/50 dark:border-purple-500/30 shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-amber-400"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-5 h-5 text-purple-600 transition-transform duration-300 -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
}
