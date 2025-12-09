<script lang="ts">
	import type { Card, SessionInfo } from "$lib/types";
	import CardOverlay from "$lib/components/CardOverlay.svelte";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { kanbanapiurl } from "$lib/config";
	import { accessToken, authFetch, getSessionInfo, isAuthenticated, refreshAccessToken } from "@davidnet/svelte-ui";
	import { get } from "svelte/store";

	let openedCard: Card | null = $state(null);
    const id = page.params.id;
	const correlationID = crypto.randomUUID();
    let token = "";
    let authencated = $state(false);
    let si: SessionInfo | null = $state(null);
    
    onMount(async ()=>{
        try {
            await refreshAccessToken(correlationID, true, true);
			if (get(accessToken)) {
				if (!(await isAuthenticated(correlationID))) {
					return;
				}
				token = String(get(accessToken));
				authencated = true;

				si = await getSessionInfo(correlationID, false);
			}
        } catch {
            console.warn("Not authenticated");
        }

		try {
			const res = await fetch(`${kanbanapiurl}card/get`, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				body: JSON.stringify({ card_id: id })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
            openedCard = data;
		} catch (e) {
			console.warn(e);
		}
    })
</script>

{#if openedCard}
	<CardOverlay
		closeOverlay={() => {
			window.close();
		}}
		{openedCard}
		board_id={0}
		{correlationID}
        canClose={false}
        canDelete={false}
        showBlanket={false}
	/>
{/if}
