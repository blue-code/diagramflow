// i18n Module for DiagramFlow
class I18n {
    constructor() {
        this.currentLocale = this.getSavedLocale() || 'ko';
        this.translations = {};
        this.fallbackLocale = 'ko';
    }

    getSavedLocale() {
        return localStorage.getItem('diagramflow_locale');
    }

    saveLocale(locale) {
        localStorage.setItem('diagramflow_locale', locale);
    }

    async loadTranslations(locale) {
        try {
            const response = await fetch(`/static/js/locales/${locale}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load locale: ${locale}`);
            }
            const translations = await response.json();
            this.translations[locale] = translations;
            return true;
        } catch (error) {
            console.error(`Error loading translations for ${locale}:`, error);
            return false;
        }
    }

    async setLocale(locale) {
        if (!this.translations[locale]) {
            const loaded = await this.loadTranslations(locale);
            if (!loaded && locale !== this.fallbackLocale) {
                // Fallback to default locale
                await this.loadTranslations(this.fallbackLocale);
                locale = this.fallbackLocale;
            }
        }

        this.currentLocale = locale;
        this.saveLocale(locale);
        this.updatePageTranslations();

        // Dispatch event for other components to react
        window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale } }));
    }

    t(key, params = {}) {
        const translation = this.getTranslation(key, this.currentLocale);
        return this.interpolate(translation, params);
    }

    getTranslation(key, locale) {
        const keys = key.split('.');
        let value = this.translations[locale];

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                // Fallback to fallback locale
                if (locale !== this.fallbackLocale) {
                    return this.getTranslation(key, this.fallbackLocale);
                }
                return key; // Return key if translation not found
            }
        }

        return value || key;
    }

    interpolate(text, params) {
        if (typeof text !== 'string') return text;

        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    updatePageTranslations() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);

            // Update text content or placeholder
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.hasAttribute('placeholder')) {
                    element.placeholder = translation;
                }
            } else if (element.tagName === 'SELECT') {
                // Skip select elements, handle options separately
            } else {
                element.textContent = translation;
            }
        });

        // Update all elements with data-i18n-title attribute (for tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });

        // Update all elements with data-i18n-html attribute (for HTML content)
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.t(key);
        });
    }

    getCurrentLocale() {
        return this.currentLocale;
    }

    getAvailableLocales() {
        return ['ko', 'en'];
    }

    async init() {
        // Load current locale translations
        await this.loadTranslations(this.currentLocale);

        // If current locale failed to load and it's not the fallback, load fallback
        if (!this.translations[this.currentLocale] && this.currentLocale !== this.fallbackLocale) {
            await this.loadTranslations(this.fallbackLocale);
            this.currentLocale = this.fallbackLocale;
        }

        this.updatePageTranslations();
    }
}

// Create global instance
window.i18n = new I18n();
