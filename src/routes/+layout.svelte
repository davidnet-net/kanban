<script lang="ts">
	import {
		ThemeProvider,
		Toaster,
		ConnectivityCheck,
		ThemeMenu,
		FlexWrapper,
		Avatar,
		Loader,
		LinkIconButton,
		getSessionInfo,
		isAuthenticated,
		refreshAccessToken,
		toast,
		authFetch
	} from "@davidnet/svelte-ui";
	import { onMount } from "svelte";
	import type { SessionInfo } from "$lib/types";
	import { page } from "$app/state";
	import "$lib/i18n/i18n";
	import { isLocaleLoaded, setAppLanguage } from "$lib/i18n/i18n";
	import { get } from "svelte/store";
	import { authapiurl } from "$lib/config";

	let { children } = $props();

	let correlationID = crypto.randomUUID();
	let authed = false;
	let si: SessionInfo | null = $state(null);
	let fontsLoaded = $state(false);

	// Load fonts in browser
	if (typeof window !== "undefined") {
		document.fonts.ready.then(() => (fontsLoaded = true));
	}

	onMount(async () => {
		// Wait for locale to load
		while (!get(isLocaleLoaded)) {
			await new Promise((r) => setTimeout(r, 50));
		}

		const initloader = document.getElementById("initloader");
		if (initloader) initloader.remove();

		try {
			si = await getSessionInfo(correlationID, true);

			const pathname = page.url.pathname;
			const boardRegex = /^\/board\/\d+$/;
			if (boardRegex.test(pathname)) {
				authed = true; // Public boards
				return;
			}

			if (!(await isAuthenticated(correlationID)) || !si) {
				window.location.href = "https://account.davidnet.net/login?redirect=" + encodeURIComponent(page.url.toString());
				return;
			}

			if (!si || si.email_verified === 0) {
				window.location.href = "https://account.davidnet.net/verify/email/check/" + si?.email;
				return;
			}

			authed = true;
			setAppLanguage(si.preferences.language);

			const res = await authFetch(authapiurl + "policy/check", correlationID);
			if (!res.ok) {
				toast({
					position: "bottom-left",
					title: "Policy check failed!",
					appearance: "danger",
					icon: "policy_alert"
				});
				return;
			}
			const data = await res.json();
			const acceptedpolicies = data.accepted ?? false;
			if (!acceptedpolicies) {
				window.location.href = "https://davidnet.net/legal/accept?redirect=" + encodeURIComponent(page.url.toString());
				return;
			}

			setInterval(
				() => {
					refreshAccessToken(correlationID, true, false);
				},
				12 * 60 * 1000
			);
		} catch (e) {
			console.error("Session error:", e);
		}

		if (!authed) {
			window.location.href = "https://account.davidnet.net/login?redirect=" + encodeURIComponent(page.url.toString());
		}
	});
</script>

<ThemeProvider />
<Toaster />
<ConnectivityCheck />

{#if fontsLoaded}
	<nav id="main-nav">
		<div class="nav-left">
			<LinkIconButton icon="apps" alt="Davidnet Home" href="https://home.davidnet.net" appearance="subtle" />
			<a href="/">Kanban</a>
		</div>
		<div class="nav-center">
			{#if import.meta.env.DEV}<span style="color: var(--token-color-text-warning)">Davidnet Development Build</span>{:else}Davidnet{/if}
		</div>
		<div class="nav-right">
			<ThemeMenu />
			<Avatar id={String(si?.userId)} owner name={si?.display_name} presence="online" src={si?.profilePicture} />
		</div>
	</nav>
{/if}

<FlexWrapper direction="column" height="calc(100vh - 48px);" width="100%;" justifycontent="center" alignitems="center">
	{#if fontsLoaded && $isLocaleLoaded}
		{@render children?.()}
	{:else}z-index
		<Loader />
	{/if}
</FlexWrapper>

<style>
	#main-nav {
		height: 48px;
		width: calc(100% - 3rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.5rem;
		background-color: var(--token-color-surface-raised-normal);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
		user-select: none;
		font-weight: 600;
		font-size: 0.9rem;
		position: sticky;
		top: 0;
		z-index: 4;
	}

	#main-nav > div {
		flex: 1;
		display: flex;
		align-items: center;
	}

	.nav-left a {
		text-decoration: none;
		color: var(--token-color-text-default-normal);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.nav-center {
		justify-content: center;
	}

	.nav-right {
		justify-content: flex-end;
	}
</style>
