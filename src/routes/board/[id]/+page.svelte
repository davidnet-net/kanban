<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { writable, get } from "svelte/store";
	import { kanbanapiurl } from "$lib/config";
	import { accessToken, refreshAccessToken } from "$lib/session";
	import { FlexWrapper, Loader, SplitButton, toast } from "@davidnet/svelte-ui";

	const id = page.params.id;

	let loading = true;
	type BoardMeta = { name?: string; background_url?: string; [key: string]: any };
	const boardMeta = writable<BoardMeta | null>(null);
	type List = { id: string; name: string; [key: string]: any };
	const lists = writable<List[]>([]);
	const cards = writable<{ [listId: string]: any[] }>({});

	// Track which list is currently adding a new card
	const addingCard = writable<{ [listId: string]: boolean }>({});
	const newCardText = writable<{ [listId: string]: string }>({});

	const correlationID = crypto.randomUUID();

	function showError(msg: string) {
		toast({
			title: "Something failed",
			desc: msg,
			icon: "crisis_alert",
			appearance: "danger",
			position: "top-center",
			autoDismiss: 5000
		});
	}

	async function authFetch(url: string, body: any) {
		await refreshAccessToken(correlationID, true, true);
		const token = get(accessToken);
		const res = await fetch(url, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {})
			},
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	// --- Real API calls ---
	async function fetchBoard() {
		try {
			const data = await authFetch(`${kanbanapiurl}board/get`, { id });
			boardMeta.set(data);
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	}

	async function fetchLists() {
		try {
			const data = await authFetch(`${kanbanapiurl}board/lists`, { board_id: id });
			lists.set(data);
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	}

	async function fetchCardsForAllLists() {
		const allLists = get(lists);
		await Promise.all(
			allLists.map(async (list: any) => {
				try {
					const data = await authFetch(`${kanbanapiurl}board/cards`, { list_id: list.id });
					cards.update((c) => ({ ...c, [list.id]: data }));
				} catch (e) {
					console.warn(e);
					showError(`Failed to load cards for list ${list.name}`);
				}
			})
		);
	}

	onMount(async () => {
		try {
			await fetchBoard();
			await fetchLists();
			await fetchCardsForAllLists();
		} finally {
			loading = false;
		}
	});

	// --- Local add card ---
	function addCard(listId: string) {
		addingCard.update((a) => ({ ...a, [listId]: true }));
		newCardText.update((t) => ({ ...t, [listId]: "" }));
	}

	function confirmNewCard(listId: string) {
		newCardText.update((t) => {
			const text = t[listId]?.trim();
			if (text) {
				cards.update((c) => ({ ...c, [listId]: [...(c[listId] || []), { id: crypto.randomUUID(), name: text }] }));
			}
			return { ...t, [listId]: "" };
		});
		addingCard.update((a) => ({ ...a, [listId]: false }));
	}

	function autoFocus(node: HTMLInputElement) {
		// Delay to let DOM update
		setTimeout(() => node.focus(), 0);
		return {
			destroy() {}
		};
	}
</script>

{#if loading}
	<p class="loading-text">Loading board {$boardMeta?.name ?? id}.</p>
	<Loader />
	<p>Getting things ready.</p>
{:else}
	<div class="board" style="background-image: url({$boardMeta?.background_url});">
		<div class="lists">
			{#each $lists as list (list.id)}
				<div class="list">
					<div class="list-header">
						<h3 class="list-title">{list.name}</h3>
					</div>

					<div class="cards">
						{#each $cards[list.id] ?? [] as card (card.id)}
							<div class="card">{card.name}</div>
						{/each}

						{#if $addingCard[list.id]}
							<input
								class="card new-card-input"
								bind:value={$newCardText[list.id]}
								placeholder="Enter card title..."
								on:keydown={(e) => e.key === "Enter" && confirmNewCard(list.id)}
								on:blur={() => confirmNewCard(list.id)}
								use:autoFocus
							/>
						{/if}
					</div>

					<div class="card-footer">
						<FlexWrapper direction="row" justifycontent="center" alignitems="center" width="100%">
							<SplitButton
								appearance="subtle"
								onClick={() => addCard(list.id)}
								actions={[
									{ label: "Option A", onClick: () => {} },
									{ label: "Option B", onClick: () => {} }
								]}
							>
								Add new card
							</SplitButton>
						</FlexWrapper>
					</div>
				</div>
			{/each}
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
	.list {
		background: var(--token-color-surface-sunken-normal);
		min-width: 272px;
		height: fit-content;
		min-height: 10vh;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		padding: 0.4rem;
		border-radius: 1rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		flex-shrink: 0;
		gap: 0.5rem;
	}
	.list-header {
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
		max-height: 70vh;
		padding: 0 0.25rem;
	}
	.card {
		background-color: var(--token-color-surface-raised-normal);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		cursor: grab;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}
	.card:active {
		cursor: grabbing;
		transform: scale(1.02);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	/* New card input looks like a card */
	.new-card-input {
		background-color: var(--token-color-surface-raised-normal);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		border: none;
		width: 100%;
		font-family: inherit;
		font-size: 1rem;
		color: var(--token-color-text-default-normal);
	}

	.new-card-input:focus {
		outline: 2px solid var(--token-color-focus);
	}
	.card-footer {
		padding-top: var(--token-space-2);
	}
</style>
