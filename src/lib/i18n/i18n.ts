import { browser } from '$app/environment';
import { derived } from 'svelte/store';
import { init, register, locale } from 'svelte-i18n';

// Documentation: https://www.codeandweb.com/babeledit/tutorials/how-to-translate-your-svelte-web-app

// Core
register('en', () => import('./lang/en.json'));
register('de', () => import('./lang/de.json'));
register('nl', () => import('./lang/nl.json'));

export let language = browser ? window.navigator.language : 'en'
console.log("Using language: " + language);

init({
    initialLocale: language,
    fallbackLocale: 'en'
});

// Utils
export const isLocaleLoaded = derived(locale, ($locale) => typeof $locale === 'string');

export const escapeHtml = (unsafe: string): string => {
    const replacements: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return unsafe.replace(/[&<>"']/g, match => replacements[match]);
}