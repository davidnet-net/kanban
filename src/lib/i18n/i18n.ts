import { browser } from '$app/environment';
import { derived } from 'svelte/store';
import { init, register, locale, waitLocale } from 'svelte-i18n';

// --- Base languages ---
register('en', () => import('./lang/en.json'));
register('de', () => import('./lang/de.json'));
register('nl', () => import('./lang/nl.json'));
register('es', () => import('./lang/es.json'));

// --- Region variants (reuse base language files) ---
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
	'es-AR': 'es'
};

// --- Determine browser language ---
let language = 'en';
if (browser) {
	const browserLang = window.navigator.language || 'en';
	const normalizedLang = regionAliases[browserLang] || regionAliases[browserLang.toLowerCase()] || browserLang.split('-')[0] || 'en';
	language = normalizedLang;
}
console.log('Using language:', language);

// --- Init svelte-i18n ---
init({
	initialLocale: language,
	fallbackLocale: 'en'
});

// --- Ensure locale is loaded before using $t ---
if (browser) {
	// Wait until the JSON file for the initial locale is loaded
	waitLocale().then(() => {
		console.log('Locale loaded:', language);
	});
}

// --- Utils ---
export const isLocaleLoaded = derived(locale, ($locale) => typeof $locale === 'string');

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
