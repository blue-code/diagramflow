/**
 * Theme Manager for Python ERD Tool
 *
 * Handles theme switching and persistence across sessions
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.themes = [
            {
                id: 'light',
                name: 'Light',
                description: 'Default light theme'
            },
            {
                id: 'dark',
                name: 'Dark',
                description: 'Dark mode theme'
            },
            {
                id: 'ocean',
                name: 'Ocean',
                description: 'Ocean-inspired theme'
            },
            {
                id: 'forest',
                name: 'Forest',
                description: 'Forest-inspired theme'
            },
            {
                id: 'sunset',
                name: 'Sunset',
                description: 'Warm sunset theme'
            },
            {
                id: 'purple',
                name: 'Purple',
                description: 'Purple-themed design'
            }
        ];

        this.storageKey = 'erd-tool-theme';
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        // Load saved theme from localStorage
        const savedTheme = this.loadTheme();
        if (savedTheme && this.isValidTheme(savedTheme)) {
            this.currentTheme = savedTheme;
        }

        // Apply theme
        this.applyTheme(this.currentTheme);

        // Create theme selector UI if not exists
        this.createThemeSelector();
    }

    /**
     * Apply theme to document
     */
    applyTheme(themeId) {
        if (!this.isValidTheme(themeId)) {
            console.error('Invalid theme:', themeId);
            return;
        }

        // Set data-theme attribute on document root
        document.documentElement.setAttribute('data-theme', themeId);

        // Update current theme
        this.currentTheme = themeId;

        // Save to localStorage
        this.saveTheme(themeId);

        // Trigger theme change event
        this.dispatchThemeChangeEvent(themeId);

        console.log('Theme applied:', themeId);
    }

    /**
     * Switch to a different theme
     */
    switchTheme(themeId) {
        this.applyTheme(themeId);
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Get all available themes
     */
    getThemes() {
        return [...this.themes];
    }

    /**
     * Check if theme is valid
     */
    isValidTheme(themeId) {
        return this.themes.some(theme => theme.id === themeId);
    }

    /**
     * Save theme to localStorage
     */
    saveTheme(themeId) {
        try {
            localStorage.setItem(this.storageKey, themeId);
        } catch (e) {
            console.error('Failed to save theme to localStorage:', e);
        }
    }

    /**
     * Load theme from localStorage
     */
    loadTheme() {
        try {
            return localStorage.getItem(this.storageKey);
        } catch (e) {
            console.error('Failed to load theme from localStorage:', e);
            return null;
        }
    }

    /**
     * Dispatch theme change event
     */
    dispatchThemeChangeEvent(themeId) {
        const event = new CustomEvent('themechange', {
            detail: {
                theme: themeId,
                themeData: this.themes.find(t => t.id === themeId)
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Create theme selector UI
     */
    createThemeSelector() {
        // Check if selector already exists
        if (document.querySelector('.theme-selector')) {
            return;
        }

        // Find header or suitable location
        const header = document.querySelector('.header');
        if (!header) {
            console.warn('Header not found, theme selector not created');
            return;
        }

        // Create theme selector container
        const selector = document.createElement('div');
        selector.className = 'theme-selector';
        selector.innerHTML = `
            <button class="theme-button" id="theme-button">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
                </svg>
                Theme
            </button>
            <div class="theme-dropdown" id="theme-dropdown"></div>
        `;

        // Add to header
        header.appendChild(selector);

        // Create theme options
        const dropdown = selector.querySelector('.theme-dropdown');
        this.themes.forEach(theme => {
            const option = document.createElement('div');
            option.className = 'theme-option';
            option.dataset.theme = theme.id;
            option.innerHTML = `
                <div class="theme-preview ${theme.id}"></div>
                <div class="theme-info">
                    <div class="theme-name">${theme.name}</div>
                </div>
            `;

            // Add click handler
            option.addEventListener('click', () => {
                this.switchTheme(theme.id);
                this.hideDropdown();
            });

            dropdown.appendChild(option);
        });

        // Add button click handler
        const button = selector.querySelector('.theme-button');
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!selector.contains(e.target)) {
                this.hideDropdown();
            }
        });

        // Update selected theme
        this.updateSelectedTheme();
    }

    /**
     * Toggle theme dropdown
     */
    toggleDropdown() {
        const dropdown = document.querySelector('.theme-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }

    /**
     * Hide theme dropdown
     */
    hideDropdown() {
        const dropdown = document.querySelector('.theme-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    /**
     * Show theme dropdown
     */
    showDropdown() {
        const dropdown = document.querySelector('.theme-dropdown');
        if (dropdown) {
            dropdown.classList.add('show');
        }
    }

    /**
     * Update selected theme in UI
     */
    updateSelectedTheme() {
        const options = document.querySelectorAll('.theme-option');
        options.forEach(option => {
            if (option.dataset.theme === this.currentTheme) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    /**
     * Cycle to next theme
     */
    nextTheme() {
        const currentIndex = this.themes.findIndex(t => t.id === this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        this.switchTheme(this.themes[nextIndex].id);
    }

    /**
     * Cycle to previous theme
     */
    previousTheme() {
        const currentIndex = this.themes.findIndex(t => t.id === this.currentTheme);
        const previousIndex = (currentIndex - 1 + this.themes.length) % this.themes.length;
        this.switchTheme(this.themes[previousIndex].id);
    }

    /**
     * Add custom theme
     */
    addCustomTheme(themeData) {
        if (!themeData.id || !themeData.name) {
            console.error('Invalid theme data');
            return false;
        }

        // Check if theme already exists
        if (this.isValidTheme(themeData.id)) {
            console.error('Theme already exists:', themeData.id);
            return false;
        }

        this.themes.push(themeData);
        return true;
    }

    /**
     * Listen for theme change events
     */
    onThemeChange(callback) {
        document.addEventListener('themechange', (e) => {
            callback(e.detail);
        });
    }
}

// Create global theme manager instance
const themeManager = new ThemeManager();

// Keyboard shortcut for theme switching (Alt+T)
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 't') {
        e.preventDefault();
        themeManager.nextTheme();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
