<script lang="ts">
	import { page } from "$app/state";
	import Error from "$lib/components/Error.svelte";
	import type { SessionInfo } from "$lib/types";
	import { onMount } from "svelte";
	import { refreshAccessToken, getSessionInfo, isAuthenticated, Loader } from "@davidnet/svelte-ui";

	let correlationID = crypto.randomUUID();
	let error = false;
	let Authenticated = false;

	onMount(async () => {
		try {
			const si: SessionInfo | null = await getSessionInfo(correlationID);

			if (!(await isAuthenticated(correlationID)) || !si || !si.admin) {
					window.location.href ="/login?redirect=" + encodeURIComponent(page.url.toString()) ;
				return;
			}

			if (!si || si.email_verified === 0) {
				window.location.href = "/verify/email/check/" + si?.email;
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

{#if error}
	<Error pageName="Admin" errorMSG="Unknown" />
{:else if Authenticated}
	<slot />
{:else}
	<Loader/>
{/if}
