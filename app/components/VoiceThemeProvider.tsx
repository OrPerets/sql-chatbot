'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import styles from './VoiceThemeProvider.module.css';

interface VoiceTheme {
  name: string;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    idle: string;
    speaking: string;
    listening: string;
    thinking: string;
    userWriting: string;
  };
  gradients: {
    primary: string;
    secondary: string;
    voice: string;
    background: string;
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
    voice: string;
  };
  animations: {
    duration: {
      fast: string;
      normal: string;
      slow: string;
    };
    easing: {
      ease: string;
      easeIn: string;
      easeOut: string;
      easeInOut: string;
    };
  };
}

interface VoiceThemeContextType {
  currentTheme: VoiceTheme;
  availableThemes: VoiceTheme[];
  setTheme: (themeName: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isHighContrast: boolean;
  toggleHighContrast: () => void;
  reduceMotion: boolean;
}

const defaultThemes: VoiceTheme[] = [
  {
    name: 'default',
    displayName: 'Default Blue',
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#06b6d4',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#1f2937',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      idle: '#3b82f6',
      speaking: '#3b82f6',
      listening: '#10b981',
      thinking: '#8b5cf6',
      userWriting: '#f59e0b'
    },
    gradients: {
      primary: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      secondary: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      voice: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    },
    shadows: {
      small: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
      medium: '0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
      large: '0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.10)',
      voice: '0 8px 32px rgba(59, 130, 246, 0.3), 0 4px 16px rgba(139, 92, 246, 0.2)'
    },
    animations: {
      duration: {
        fast: '0.15s',
        normal: '0.3s',
        slow: '0.6s'
      },
      easing: {
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  {
    name: 'green',
    displayName: 'Nature Green',
    colors: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#34d399',
      background: '#ffffff',
      surface: '#f0fdf4',
      text: '#1f2937',
      textSecondary: '#6b7280',
      border: '#d1fae5',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      idle: '#10b981',
      speaking: '#059669',
      listening: '#34d399',
      thinking: '#6ee7b7',
      userWriting: '#f59e0b'
    },
    gradients: {
      primary: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      secondary: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
      voice: 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
    },
    shadows: {
      small: '0 1px 3px rgba(16, 185, 129, 0.12), 0 1px 2px rgba(16, 185, 129, 0.24)',
      medium: '0 3px 6px rgba(16, 185, 129, 0.15), 0 2px 4px rgba(16, 185, 129, 0.12)',
      large: '0 10px 20px rgba(16, 185, 129, 0.15), 0 3px 6px rgba(16, 185, 129, 0.10)',
      voice: '0 8px 32px rgba(16, 185, 129, 0.3), 0 4px 16px rgba(52, 211, 153, 0.2)'
    },
    animations: {
      duration: {
        fast: '0.15s',
        normal: '0.3s',
        slow: '0.6s'
      },
      easing: {
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  {
    name: 'purple',
    displayName: 'Royal Purple',
    colors: {
      primary: '#8b5cf6',
      secondary: '#a855f7',
      accent: '#c084fc',
      background: '#ffffff',
      surface: '#faf5ff',
      text: '#1f2937',
      textSecondary: '#6b7280',
      border: '#e9d5ff',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      idle: '#8b5cf6',
      speaking: '#a855f7',
      listening: '#10b981',
      thinking: '#c084fc',
      userWriting: '#f59e0b'
    },
    gradients: {
      primary: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      secondary: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
      voice: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #c084fc 100%)',
      background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)'
    },
    shadows: {
      small: '0 1px 3px rgba(139, 92, 246, 0.12), 0 1px 2px rgba(139, 92, 246, 0.24)',
      medium: '0 3px 6px rgba(139, 92, 246, 0.15), 0 2px 4px rgba(139, 92, 246, 0.12)',
      large: '0 10px 20px rgba(139, 92, 246, 0.15), 0 3px 6px rgba(139, 92, 246, 0.10)',
      voice: '0 8px 32px rgba(139, 92, 246, 0.3), 0 4px 16px rgba(168, 85, 247, 0.2)'
    },
    animations: {
      duration: {
        fast: '0.15s',
        normal: '0.3s',
        slow: '0.6s'
      },
      easing: {
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  {
    name: 'orange',
    displayName: 'Warm Orange',
    colors: {
      primary: '#f59e0b',
      secondary: '#d97706',
      accent: '#fbbf24',
      background: '#ffffff',
      surface: '#fffbeb',
      text: '#1f2937',
      textSecondary: '#6b7280',
      border: '#fde68a',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      idle: '#f59e0b',
      speaking: '#d97706',
      listening: '#10b981',
      thinking: '#fbbf24',
      userWriting: '#f59e0b'
    },
    gradients: {
      primary: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      secondary: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      voice: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fde047 100%)',
      background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
    },
    shadows: {
      small: '0 1px 3px rgba(245, 158, 11, 0.12), 0 1px 2px rgba(245, 158, 11, 0.24)',
      medium: '0 3px 6px rgba(245, 158, 11, 0.15), 0 2px 4px rgba(245, 158, 11, 0.12)',
      large: '0 10px 20px rgba(245, 158, 11, 0.15), 0 3px 6px rgba(245, 158, 11, 0.10)',
      voice: '0 8px 32px rgba(245, 158, 11, 0.3), 0 4px 16px rgba(251, 191, 36, 0.2)'
    },
    animations: {
      duration: {
        fast: '0.15s',
        normal: '0.3s',
        slow: '0.6s'
      },
      easing: {
        ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  }
];

const VoiceThemeContext = createContext<VoiceThemeContextType | undefined>(undefined);

interface VoiceThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
}

export const VoiceThemeProvider: React.FC<VoiceThemeProviderProps> = ({
  children,
  defaultTheme = 'default'
}) => {
  const [currentThemeName, setCurrentThemeName] = useState(defaultTheme);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Get current theme
  const currentTheme = defaultThemes.find(theme => theme.name === currentThemeName) || defaultThemes[0];

  // Apply theme to CSS variables
  const applyTheme = useCallback((theme: VoiceTheme) => {
    const root = document.documentElement;
    
    // Colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--voice-color-${key}`, value);
    });
    
    // Gradients
    Object.entries(theme.gradients).forEach(([key, value]) => {
      root.style.setProperty(`--voice-gradient-${key}`, value);
    });
    
    // Shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--voice-shadow-${key}`, value);
    });
    
    // Animations
    Object.entries(theme.animations.duration).forEach(([key, value]) => {
      root.style.setProperty(`--voice-duration-${key}`, value);
    });
    
    Object.entries(theme.animations.easing).forEach(([key, value]) => {
      root.style.setProperty(`--voice-easing-${key}`, value);
    });
  }, []);

  // Set theme
  const setTheme = useCallback((themeName: string) => {
    const theme = defaultThemes.find(t => t.name === themeName);
    if (theme) {
      setCurrentThemeName(themeName);
      applyTheme(theme);
      localStorage.setItem('voice-theme', themeName);
    }
  }, [applyTheme]);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const newValue = !prev;
      document.documentElement.classList.toggle('voice-dark-mode', newValue);
      localStorage.setItem('voice-dark-mode', newValue.toString());
      return newValue;
    });
  }, []);

  // Toggle high contrast
  const toggleHighContrast = useCallback(() => {
    setIsHighContrast(prev => {
      const newValue = !prev;
      document.documentElement.classList.toggle('voice-high-contrast', newValue);
      localStorage.setItem('voice-high-contrast', newValue.toString());
      return newValue;
    });
  }, []);

  // Initialize theme from localStorage and system preferences
  useEffect(() => {
    // Load saved theme
    const savedTheme = localStorage.getItem('voice-theme');
    if (savedTheme && defaultThemes.find(t => t.name === savedTheme)) {
      setCurrentThemeName(savedTheme);
    }

    // Load dark mode preference
    const savedDarkMode = localStorage.getItem('voice-dark-mode');
    if (savedDarkMode !== null) {
      setIsDarkMode(savedDarkMode === 'true');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }

    // Load high contrast preference
    const savedHighContrast = localStorage.getItem('voice-high-contrast');
    if (savedHighContrast !== null) {
      setIsHighContrast(savedHighContrast === 'true');
    } else {
      // Check system preference
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
      setIsHighContrast(prefersHighContrast);
    }

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduceMotion(prefersReducedMotion);
  }, []);

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme, applyTheme]);

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('voice-dark-mode', isDarkMode);
  }, [isDarkMode]);

  // Apply high contrast class
  useEffect(() => {
    document.documentElement.classList.toggle('voice-high-contrast', isHighContrast);
  }, [isHighContrast]);

  // Apply reduced motion class
  useEffect(() => {
    document.documentElement.classList.toggle('voice-reduce-motion', reduceMotion);
  }, [reduceMotion]);

  // Listen for system preference changes
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('voice-dark-mode') === null) {
        setIsDarkMode(e.matches);
      }
    };

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('voice-high-contrast') === null) {
        setIsHighContrast(e.matches);
      }
    };

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setReduceMotion(e.matches);
    };

    darkModeQuery.addEventListener('change', handleDarkModeChange);
    highContrastQuery.addEventListener('change', handleHighContrastChange);
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    return () => {
      darkModeQuery.removeEventListener('change', handleDarkModeChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
    };
  }, []);

  const contextValue: VoiceThemeContextType = {
    currentTheme,
    availableThemes: defaultThemes,
    setTheme,
    isDarkMode,
    toggleDarkMode,
    isHighContrast,
    toggleHighContrast,
    reduceMotion
  };

  return (
    <VoiceThemeContext.Provider value={contextValue}>
      <div className={styles.themeProvider}>
        {children}
      </div>
    </VoiceThemeContext.Provider>
  );
};

export const useVoiceTheme = () => {
  const context = useContext(VoiceThemeContext);
  if (context === undefined) {
    throw new Error('useVoiceTheme must be used within a VoiceThemeProvider');
  }
  return context;
};

// Theme Selector Component
export const VoiceThemeSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { currentTheme, availableThemes, setTheme, isDarkMode, toggleDarkMode, isHighContrast, toggleHighContrast } = useVoiceTheme();

  return (
    <div className={`${styles.themeSelector} ${className}`}>
      <div className={styles.themeSelectorHeader}>
        <h3>🎨 Voice Theme</h3>
      </div>
      
      {/* Theme Colors */}
      <div className={styles.themeGrid}>
        {availableThemes.map((theme) => (
          <button
            key={theme.name}
            className={`${styles.themeOption} ${currentTheme.name === theme.name ? styles.selected : ''}`}
            onClick={() => setTheme(theme.name)}
            aria-label={`Switch to ${theme.displayName} theme`}
          >
            <div className={styles.themePreview}>
              <div 
                className={styles.themeColorPrimary} 
                style={{ backgroundColor: theme.colors.primary }}
              />
              <div 
                className={styles.themeColorSecondary} 
                style={{ backgroundColor: theme.colors.secondary }}
              />
              <div 
                className={styles.themeColorAccent} 
                style={{ backgroundColor: theme.colors.accent }}
              />
            </div>
            <span className={styles.themeName}>{theme.displayName}</span>
          </button>
        ))}
      </div>
      
      {/* Theme Options */}
      <div className={styles.themeOptions}>
        <label className={styles.themeToggle}>
          <input
            type="checkbox"
            checked={isDarkMode}
            onChange={toggleDarkMode}
          />
          <span className={styles.toggleSlider}></span>
          <span className={styles.toggleLabel}>🌙 Dark Mode</span>
        </label>
        
        <label className={styles.themeToggle}>
          <input
            type="checkbox"
            checked={isHighContrast}
            onChange={toggleHighContrast}
          />
          <span className={styles.toggleSlider}></span>
          <span className={styles.toggleLabel}>🔲 High Contrast</span>
        </label>
      </div>
    </div>
  );
};

export default VoiceThemeProvider;
