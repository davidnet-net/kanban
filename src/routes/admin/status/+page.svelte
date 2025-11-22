<script lang="ts">
	import { FlexWrapper, Space, Icon, LinkButton, Button, metadata } from "@davidnet/svelte-ui";

	const commitHash = import.meta.env.VITE_COMMIT_HASH || "unknown";
	const commitUrl = import.meta.env.VITE_COMMIT_URL || "unknown";
	console.log(import.meta.env.VITE_COMMIT_URL);

	// Import your locale JSONs
	import de from "$lib/i18n/lang/de.json";
	import en from "$lib/i18n/lang/en.json";
	import es from "$lib/i18n/lang/es.json";
	import nl from "$lib/i18n/lang/nl.json";

	// Add all your locales here
	const locales = { de, en, es, nl };

	// Base locale to compare against
	const baseLocaleKey = "en";
	const baseLocale = locales[baseLocaleKey];

	type CoverageReport = {
		locale: string;
		coverage: number;
		missing: string[];
	};

	function getCoverage(base: Record<string, any>, target: Record<string, any>, locale: string): CoverageReport {
		const keys = Object.keys(base);
		const translatedKeys = keys.filter((key) => key in target);
		const coverage = (translatedKeys.length / keys.length) * 100;
		const missing = keys.filter((key) => !(key in target));
		return { locale, coverage, missing };
	}

	const reports: CoverageReport[] = Object.entries(locales)
		.filter(([key]) => key !== baseLocaleKey)
		.map(([localeKey, localeData]) => getCoverage(baseLocale, localeData, localeKey));
</script>

<Space height="var(--token-space-4)" />
<FlexWrapper width="100%" justifycontent="space-around" direction="row">
	<LinkButton href="/admin">Admin</LinkButton>
	<Button
		onClick={() => {
			history.back();
		}}
		iconbefore="arrow_back">Back</Button
	>

	<LinkButton href="/logout" iconafter="logout">Log out</LinkButton>
</FlexWrapper>
<Space height="var(--token-space-4)" />
<h1>Status</h1>
<Space height="var(--token-space-2)" />
<FlexWrapper direction="column" gap="var(--token-space-4)" width="100%">
	<FlexWrapper direction="row" gap="var(--token-space-6)">
		<div class="info">
			<img src="https://design.davidnet.net/images/logos/svelte-ui.png" alt="svelte-ui logo" aria-hidden="true" />
			<span style="white-space: nowrap;">SvelteUI | {metadata.version} | <a href={metadata.commitUrl}>{metadata.commitHash.slice(0, 7)}</a></span>
		</div>
	</FlexWrapper>
	<FlexWrapper direction="row" gap="var(--token-space-6)">
		<div class="info">
			<Icon icon="deployed_code" />
			{#if commitUrl === "unknown"}
				<span style="white-space: nowrap;">Account | Version Unknown</span>
			{:else}
				<span style="white-space: nowrap;">Account | <a href={commitUrl}>{commitHash.slice(0, 7)}</a></span>
			{/if}
		</div>
	</FlexWrapper>
</FlexWrapper>

<Space height="var(--token-space-4)" />

<h2 style="text-align: center;">Translation Coverage</h2>
<Space height="var(--token-space-2)" />

<table style="width: 100%; border-collapse: collapse;">
	<thead>
		<tr>
			<th style="text-align: left; padding: var(--token-space-2); border-bottom: 1px solid var(--token-color-surface-raised-normal);">Locale</th
			>
			<th style="text-align: right; padding: var(--token-space-2); border-bottom: 1px solid var(--token-color-surface-raised-normal);"
				>Coverage</th
			>
		</tr>
	</thead>
	<tbody>
		{#each reports as report}
			<tr>
				<td style="text-align: left; padding: var(--token-space-2); border-bottom: 1px solid var(--token-color-surface-raised-normal);">{report.locale}</td>
				<td style="text-align: right; padding: var(--token-space-2); border-bottom: 1px solid var(--token-color-surface-raised-normal);"
					>{report.coverage.toFixed(1)}%</td
				>
			</tr>
		{/each}
	</tbody>
</table>

<Space height="var(--token-space-2)" />

<style>
	h1 {
		text-align: center;
		font-size: 1.85rem;
	}
	h2 {
		font-size: 1.5rem;
	}
	.info {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-around;
		width: 150%;
		vertical-align: middle;
		height: 30px;
		background-color: var(--token-color-surface-raised-normal);
		padding: var(--token-space-3) var(--token-space-6);
		border-radius: 2rem;
		gap: var(--token-space-3);
		transition:
			transform 0.4s ease,
			box-shadow 0.4s ease;
	}
	.info:hover,
	.info:focus {
		background-color: var(--token-color-surface-raised-hover);
		transform: scale(1.02);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
	}
	.info > img {
		height: 100%;
		aspect-ratio: 1 / 1;
	}
	table th,
	table td {
		font-size: 0.95rem;
	}
</style>
