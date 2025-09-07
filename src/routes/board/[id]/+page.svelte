<script lang="ts">
	import { onMount } from "svelte";
	import { dndzone } from "svelte-dnd-action";
	import { page } from "$app/state";
	import { writable, get } from "svelte/store";
	import { kanbanapiurl } from "$lib/config";
	import { accessToken, refreshAccessToken } from "$lib/session";
	import { Button, FlexWrapper, Loader, SplitButton, toast } from "@davidnet/svelte-ui";

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

	// Track adding a new list
	const addingList = writable(false);
	const newListName = writable("");

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
					const data = await authFetch(`${kanbanapiurl}list/cards`, { list_id: list.id });
					// Sort cards by position
					data.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
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

	async function confirmNewCard(listId: string) {
		const t = get(newCardText);
		const text = t[listId]?.trim();
		if (!text) {
			newCardText.update((t) => ({ ...t, [listId]: "" }));
			return;
		}

		const tempId = crypto.randomUUID();

		// Optimistically add card locally at the end
		cards.update((c) => ({
			...c,
			[listId]: [...(c[listId] || []), { id: tempId, name: text, isLoading: true }].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
		}));

		addingCard.update((a) => ({ ...a, [listId]: false }));
		newCardText.update((t) => ({ ...t, [listId]: "" }));

		try {
			const newCard = await authFetch(`${kanbanapiurl}card/add`, {
				list_id: listId,
				name: text
			});

			// Replace the temporary card with the real one
			cards.update((c) => ({
				...c,
				[listId]: c[listId].map((card) => (card.id === tempId ? newCard : card)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
			}));
		} catch (err) {
			console.error(err);
			// Remove temporary card on failure
			cards.update((c) => ({
				...c,
				[listId]: c[listId].filter((card) => card.id !== tempId)
			}));
			showError(`Failed to create card: ${err}`);
		}
	}

	// --- Add list ---
	async function confirmNewList() {
		const name = get(newListName)?.trim();
		if (!name) return;

		const tempId = crypto.randomUUID();
		lists.update((l) => [...l, { id: tempId, name }]);
		addingList.set(false);
		newListName.set("");

		try {
			const newList = await authFetch(`${kanbanapiurl}list/add`, {
				board_id: id,
				name
			});

			lists.update((l) => l.map((list) => (list.id === tempId ? newList : list)));
		} catch (err) {
			console.error(err);
			lists.update((l) => l.filter((list) => list.id !== tempId));
			showError(`Failed to create list: ${err}`);
		}
	}

	function autoFocus(node: HTMLInputElement) {
		setTimeout(() => node.focus(), 0);
		return { destroy() {} };
	}

	function autoFocusInput(node: HTMLInputElement) {
		setTimeout(() => node.focus(), 0);
		return { destroy() {} };
	}

	async function moveList(e: CustomEvent<{ items: List[] }>) {
		const newOrder = e.detail.items.map((item, index) => ({
			...item,
			position: index + 1
		}));

		lists.set(newOrder);

		try {
			await authFetch(`${kanbanapiurl}list/move`, {
				board_id: id,
				lists: newOrder.map(({ id, position }) => ({ id, position }))
			});
		} catch (err) {
			console.error("Failed to move lists:", err);
			showError("Failed to update list order on server.");

			// Reset
			await fetchLists();
		}
	}
</script>

{#if loading}
	<p class="loading-text">Loading board {$boardMeta?.name ?? id}.</p>
	<Loader />
	<p>Getting things ready.</p>
{:else}
	<div class="board" style="background-image: url({$boardMeta?.background_url});">
		<div
			class="lists"
			use:dndzone={{
				items: $lists,
				flipDurationMs: 300,
				dropFromOthersDisabled: true,
				dropTargetStyle: { border: "2px dashed rgba(128, 128, 128, 0.5)" },
				type: "list",
				delayTouchStart: true
			}}
			on:consider={(e) => lists.set(e.detail.items)}
			on:finalize={(e) => {
				moveList(e);
			}}
		>
			{#each $lists as list (list.id)}
				<div class="list">
					<div class="list-header">
						<h3 class="list-title">{list.name}</h3>
					</div>

					<div
						class="cards"
						use:dndzone={{
							items: $cards[list.id] ?? [],
							flipDurationMs: 300,
							type: "card",
							dropTargetStyle: { border: "2px dashed rgba(128, 128, 128, 0.5)" },
							delayTouchStart: true
						}}
						on:consider={(e) => cards.update((c) => ({ ...c, [list.id]: e.detail.items }))}
						on:finalize={(e) => cards.update((c) => ({ ...c, [list.id]: e.detail.items }))}
					>
						{#each $cards[list.id] ?? [] as card (card.id)}
							<div class="card" data-id={card.id}>{card.name}</div>
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

			<div class="add-list">
				{#if $addingList}
					<input
						bind:value={$newListName}
						class="new-list-input"
						placeholder="Enter list name..."
						on:keydown={(e) => e.key === "Enter" && confirmNewList()}
						on:blur={confirmNewList}
						use:autoFocusInput
					/>
				{:else}
					<Button appearance="subtle" onClick={() => addingList.set(true)}>Add list</Button>
				{/if}
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
	}
	.list-header {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.list-title {
		margin-bottom: 0px;
	}

	.add-list {
		background: var(--token-color-surface-sunken-normal);
		min-width: 272px;
		height: fit-content;
		display: flex;
		flex-direction: column;
		padding: 0.4rem;
		border-radius: 1rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		flex-shrink: 0;
		gap: 0.5rem;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
		max-height: 70vh;
		padding: 0 0.25rem;
		min-height: 1vh;
		padding-bottom: 2rem;
		padding-top: 1.5rem;
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

	.new-card-input,
	.new-list-input {
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
	.new-card-input:focus,
	.new-list-input:focus {
		outline: 2px solid var(--token-color-focus);
	}
	.card-footer {
		padding-top: var(--token-space-2);
	}
</style>
