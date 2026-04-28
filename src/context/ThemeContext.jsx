import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Forced Dark Mode as per user request
  const [theme] = useState('dark');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');
    // Ensure localStorage stays as dark
    localStorage.setItem('theme', 'dark');
  }, []);

  const toggleTheme = () => {
    // Disabled for now
    console.log('Theme toggle is currently disabled. System is locked to Dark Mode.');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
