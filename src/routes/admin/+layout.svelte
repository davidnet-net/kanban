<script lang="ts">
	import { page } from "$app/state";
	import Error from "$lib/components/Error.svelte";
	import type { SessionInfo } from "$lib/types";
	import { onMount } from "svelte";
	import { refreshAccessToken, getSessionInfo, isAuthenticated, Loader, authFetch, toast } from "@davidnet/svelte-ui";
	import { authapiurl } from "$lib/config";

	let correlationID = crypto.randomUUID();
	let error = false;
	let Authenticated = false;

	onMount(async () => {
		try {
			const si: SessionInfo | null = await getSessionInfo(correlationID);

			if (!(await isAuthenticated(correlationID)) || !si || !si.admin) {
				window.location.href ="https://account.davidnet.net/login?redirect=" + encodeURIComponent(page.url.toString()) ;
				return;
			}

			if (!si || si.email_verified === 0) {
				window.location.href = "https://account.davidnet.net/verify/email/check/" + si?.email;
				return;
			}

			Authenticated = true;
			setInterval(
				() => {
					refreshAccessToken(correlationID, true, false);
				},
				12 * 60 * 1000
			);
		} catch (e) {
			console.error("Session error:", e);
			error = true;
		}
	});
</script>

<div id="background">
	{#if error}
		<Error pageName="Admin" errorMSG="Unknown" />
	{:else if Authenticated}
		<slot />
	{:else}
		<Loader/>
	{/if}
</div>

<style>
	#background {
		background-color: var(--token-color-surface-sunken-normal);
		padding: 4rem 5rem;
		padding-top: 0rem;
		border-radius: 1rem;
		width: 300px;
		height: 680px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
	}
</style>