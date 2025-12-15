// src/lib/i18n/i18n.ts
import { browser } from "$app/environment";
import { writable, derived } from "svelte/store";
import { init, register, locale, waitLocale } from "svelte-i18n";

// ------------------------------
// Register base languages
// ------------------------------
register("en", () => import("./lang/en.json"));
register("de", () => import("./lang/de.json"));
register("nl", () => import("./lang/nl.json"));
register("es", () => import("./lang/es.json"));
register("nl", () => import("./lang/nl.json"));
register("es", () => import("./lang/es.json"));
// ------------------------------
// Region aliases
// ------------------------------
const regionAliases: Record<string, string> = {
	"en-US": "en",
	"en-GB": "en",
	"en-CA": "en",
	"en-AU": "en",
	"de-DE": "de",
	"de-AT": "de",
	"de-CH": "de",
	"nl-NL": "nl",
	"nl-BE": "nl",
	"es-ES": "es",
	"es-MX": "es",
	"es-AR": "es",
	en: "en",
	de: "de",
	nl: "nl"
};

// ------------------------------
// Writable store for current language
// ------------------------------
export const currentLanguage = writable("en");

// ------------------------------
// Initialize svelte-i18n
// ------------------------------
init({
	initialLocale: undefined,
	fallbackLocale: "en"
});
console.debug('[Davidnet Translator] svelte-i18n initialized with fallbackLocale: "en"');

// ------------------------------
// Detect browser language
// ------------------------------
if (browser) {
	const browserLang = window.navigator.language || "en";
	console.debug("[Davidnet Translator] Browser language detected:", browserLang);

	const normalizedLang = regionAliases[browserLang] || regionAliases[browserLang.toLowerCase()] || browserLang.split("-")[0] || "en";

	currentLanguage.set(normalizedLang);
	locale.set(normalizedLang);

	console.debug("[Davidnet Translator] Normalized language set:", normalizedLang);
}

// ------------------------------
// Utility: ensure locale is loaded before usage
// ------------------------------
export const isLocaleLoaded = derived(locale, ($locale, set) => {
	if (!$locale) {
		console.debug("[Davidnet Translator] Locale not set yet");
		return set(false);
	}

	console.debug("[Davidnet Translator] Waiting for locale to load:", $locale);
	waitLocale()
		.then(() => {
			console.debug("[Davidnet Translator] Locale loaded:", $locale);
			set(true);
		})
		.catch((err) => {
			console.error("[Davidnet Translator] Error loading locale:", err);
			set(false);
		});
});

// ------------------------------
// Optional HTML escape utility
// ------------------------------
export const escapeHtml = (unsafe: string): string => {
	const replacements: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;"
	};
	const escaped = unsafe.replace(/[&<>"']/g, (match) => replacements[match]);
	console.debug("[Davidnet Translator] escapeHtml input:", unsafe, "escaped:", escaped);
	return escaped;
};

// ------------------------------
// Helper to dynamically change language
// ------------------------------
export function setAppLanguage(lang: string) {
	if (!lang) {
		console.warn("[Davidnet Translator] setAppLanguage called with empty lang");
		return;
	}

	console.debug("[Davidnet Translator] Changing language to:", lang);
	currentLanguage.set(lang);
	locale.set(lang);
}
