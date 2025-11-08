// src/lib/i18n/i18n.ts
import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { init, register, locale, waitLocale } from 'svelte-i18n';

// ------------------------------
// Register base languages
// ------------------------------
register('en', () => import('./lang/en.json'));
register('de', () => import('./lang/de.json'));
register('nl', () => import('./lang/nl.json'));
register('es', () => import('./lang/es.json'));

// ------------------------------
// Region aliases
// ------------------------------
const regionAliases: Record<string, string> = {
	'en-US': 'en',
	'en-GB': 'en',
	'en-CA': 'en',
	'en-AU': 'en',
	'de-DE': 'de',
	'de-AT': 'de',
	'de-CH': 'de',
	'nl-NL': 'nl',
	'nl-BE': 'nl',
	'es-ES': 'es',
	'es-MX': 'es',
	'es-AR': 'es',
	'en': 'en',
	'de': 'de',
	'nl': 'nl'
};

// ------------------------------
// Writable store for current language
// ------------------------------
// Default to 'en' initially
export const currentLanguage = writable('en');

// ------------------------------
// Initialize svelte-i18n
// ------------------------------
init({
	initialLocale: undefined,
	fallbackLocale: 'en'
});

// ------------------------------
// Detect browser language
// ------------------------------
if (browser) {
	const browserLang = window.navigator.language || 'en';
	const normalizedLang =
		regionAliases[browserLang] ||
		regionAliases[browserLang.toLowerCase()] ||
		browserLang.split('-')[0] ||
		'en';

	currentLanguage.set(normalizedLang); 
	locale.set(normalizedLang);
	console.log('Using language:', normalizedLang);
}

// ------------------------------
// Utility: ensure locale is loaded before usage
// ------------------------------
export const isLocaleLoaded = derived(locale, ($locale, set) => {
	if (!$locale) return set(false);

	waitLocale().then(() => set(true));
});

// ------------------------------
// Optional HTML escape utility
// ------------------------------
export const escapeHtml = (unsafe: string): string => {
	const replacements: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return unsafe.replace(/[&<>"']/g, (match) => replacements[match]);
};

// ------------------------------
// Helper to dynamically change language
// ------------------------------
export function setAppLanguage(lang: string) {
	if (!lang) return;
	currentLanguage.set(lang);
	locale.set(lang);
}
