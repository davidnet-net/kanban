import { browser } from '$app/environment';
import { derived } from 'svelte/store';
import { init, register, locale } from 'svelte-i18n';

// --- Base languages ---
register('en', () => import('./lang/en.json'));
register('de', () => import('./lang/de.json'));
register('nl', () => import('./lang/nl.json'));

// --- Region variants (reuse base language files) ---
const regionAliases = {
	'en-US': 'en',
	'en-GB': 'en',
	'en-CA': 'en',
	'en-AU': 'en',
	'de-DE': 'de',
	'de-AT': 'de',
	'de-CH': 'de',
	'nl-NL': 'nl',
	'nl-BE': 'nl'
};

for (const [region, base] of Object.entries(regionAliases)) {
	register(region, () => import(`./lang/${base}.json`));
}

// --- Determine browser language ---
export let language = 'en';
if (browser) {
	const browserLang = window.navigator.language;
	language = regionAliases[browserLang as keyof typeof regionAliases] || browserLang.split('-')[0] || 'en';
}
console.log('Using language:', language);

// --- Init svelte-i18n ---
init({
	initialLocale: language,
	fallbackLocale: 'en'
});

// --- Utils ---
export const isLocaleLoaded = derived(locale, ($locale) => typeof $locale === 'string');

export const escapeHtml = (unsafe: string): string => {
	const replacements: { [key: string]: string } = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return unsafe.replace(/[&<>"']/g, (match) => replacements[match]);
};
