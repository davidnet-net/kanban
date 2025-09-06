<script lang="ts">
	import { page } from "$app/state";
	import { kanbanapiurl } from "$lib/config";
	import { accessToken, refreshAccessToken } from "$lib/session";
	import type { Board } from "$lib/types";
	import { wait } from "$lib/utils/time";
	import { Button, FlexWrapper, IconButton, Loader, SplitButton, toast } from "@davidnet/svelte-ui";
	import { onMount } from "svelte";
	import { writable, get } from "svelte/store";

	const id = page.params.id;
	let loading = $state(true); // keep your $state usage
	const boardMeta = writable<Board | null>(null);
	const correlationID = crypto.randomUUID();

	function showError(msg: string) {
		toast({
			title: "Something failed",
			desc: "Error: " + msg,
			icon: "crisis_alert",
			appearance: "danger",
			position: "top-center",
			autoDismiss: 5000
		});
	}

	onMount(async () => {
		try {
			await refreshAccessToken(correlationID, true, true);
			const token = get(accessToken);

			const res = await fetch(`${kanbanapiurl}board/get`, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ id })
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			const data: Board = await res.json();
			boardMeta.set(data);
			await wait(100);
			loading = false;
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	});
</script>

{#if loading}
	<p class="loading-text">Loading board {get(boardMeta)?.name ?? id}.</p>
	<Loader />
	<p>Getting things ready.</p>
{:else}
	<div class="board" style="background-image: url({get(boardMeta)?.background_url});">
		<div class="lists">
			{#each Array(3) as _, listIndex}
				<div class="list">
					<div class="list-header">
						<h3 class="list-title">Task {listIndex + 1}</h3>
						<div class="list-header-button">
							<IconButton
								icon="more_horiz"
								appearance="subtle"
								alt="More options"
								onClick={() => {}}
							/>
						</div>
					</div>

					<div class="cards">
						{#each Array(40) as _, cardIndex}
							<div class="card">Task {cardIndex + 1}</div>
						{/each}
					</div>

					<FlexWrapper justifycontent="center" alignitems="center" width="100%">
						<SplitButton
							appearance="subtle"
							onClick={() => console.log("Main clicked")}
							actions={[
								{ label: "a", onClick: () => console.log("Clicked A") },
								{ label: "b", onClick: () => console.log("Clicked B") }
							]}
						>
							Add new card
						</SplitButton>
					</FlexWrapper>
				</div>
			{/each}

			<div class="newlistcontainer">
				<Button appearance="subtle" stretchwidth onClick={() => {}}>Add new list</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.loading-text {
		font-weight: bold;
		font-size: 1.2rem;
	}

	.board {
		height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: var(--token-color-background);
		overflow: hidden;
		padding: 1rem 0;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
	}

	.lists {
		display: flex;
		gap: 1.5rem;
		overflow-x: auto;
		padding-left: 1rem;
		padding-bottom: 2rem;
		flex-grow: 1;
		scroll-behavior: smooth;
	}

	.lists::-webkit-scrollbar {
		height: 6px;
	}

	.lists::-webkit-scrollbar-thumb {
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 3px;
	}

	.list {
		background: var(--token-color-surface-sunken-normal);
		min-width: 272px;
		height: fit-content;
		min-height: 10vh;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		padding: 0.5rem;
		border-radius: 1rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		flex-shrink: 0;
		gap: 0.5rem;
	}

	.newlistcontainer {
		min-width: 272px;
		display: flex;
		padding: 0.5rem;
		border-radius: 1rem;
		flex-shrink: 0;
	}

	.list-header {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		padding-right: 2rem;
		padding-top: var(--token-space-5);
		padding-bottom: var(--token-space-1);
		margin-bottom: 0.5rem;
	}

	.list-header-button {
		position: absolute;
		right: 0;
	}

	.list-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--token-color-text-default-normal);
		margin: 0;
		margin-bottom: 1rem;
		text-align: center;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
		max-height: 70vh;
		padding: 0 0.25rem;
	}

	.cards::-webkit-scrollbar {
		width: 0;
	}

	.card {
		background-color: var(--token-color-surface-raised-normal);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		cursor: grab;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.card:active {
		cursor: grabbing;
		transform: scale(1.02);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}
</style>
