<script lang="ts">
	import { onMount } from "svelte";
	import { dndzone } from "svelte-dnd-action";
	import { page } from "$app/state";
	import { writable, get } from "svelte/store";
	import { kanbanapiurl } from "$lib/config";
	import { accessToken, getSessionInfo, isAuthenticated, refreshAccessToken } from "$lib/session";
	import {
		Button,
		Dropdown,
		FlexWrapper,
		Icon,
		IconButton,
		IconDropdown,
		LinkButton,
		Loader,
		Modal,
		Space,
		SplitButton,
		toast
	} from "@davidnet/svelte-ui";
	import type { Card, SessionInfo, BoardMeta } from "$lib/types";
	import { goto } from "$app/navigation";
	import CardOverlay from "$lib/components/CardOverlay.svelte";
	import BoardAccess from "$lib/components/BoardAccess.svelte";

	const id = page.params.id;
	let view: "kanban" | "calendar" = $state("kanban");
	let eventSource: EventSource | null = null;

	let loading = $state(true);

	const boardMeta = writable<BoardMeta | null>(null);
	type List = { id: string; name: string; [key: string]: any };
	const lists = writable<List[]>([]);
	const cards = writable<{ [listId: string]: any[] }>({});
	let board_favorited = writable(false);
	let common_error: string | null = $state(null);

	// Track which list is currently adding a new card
	const addingCard = writable<{ [listId: string]: boolean }>({});
	const newCardText = writable<{ [listId: string]: string }>({});

	// Track adding a new list
	const addingList = writable(false);
	const newListName = writable("");

	const correlationID = crypto.randomUUID();
	let token = "";

	// Modals
	let showBoardDelModal = $state(false);
	let showBoardLeaveModal = $state(false);
	let authencated = $state(false);
	let can_edit = $state(false);
	let is_owner = $state(false);
	let si: SessionInfo | null = $state(null);

	// Calendar
	let CalendarListID: string | null = $state(null);

	function showError(msg: string) {
		if (common_error) {
			return;
		}

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

	async function fetchBoard() {
		try {
			const res = await fetch(`${kanbanapiurl}board/get`, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				body: JSON.stringify({ id })
			});
			const data = await res.json();
			if (!res.ok) {
				if (data && data.error === "Board not found") {
					common_error = "Board doesn't exist.";
				}

				if (data && data.error === "Not board member") {
					common_error = `You are not an board member! Ask the owner for access.`;
				}

				throw new Error(`HTTP ${res.status}`);
			}

			boardMeta.set(data);
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	}

	async function fetchLists() {
		try {
			const res = await fetch(`${kanbanapiurl}board/lists`, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				body: JSON.stringify({ board_id: id })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			lists.set(data);

			// CalendarListID (Default view on calendar list)
			if (data.length > 0 && !CalendarListID) {
				CalendarListID = data[0].id;
			}
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
					const res = await fetch(`${kanbanapiurl}list/cards`, {
						method: "POST",
						credentials: "include",
						headers: {
							"Content-Type": "application/json",
							...(token ? { Authorization: `Bearer ${token}` } : {})
						},
						body: JSON.stringify({ list_id: list.id })
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
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
			await refreshAccessToken(correlationID, true, true);
			if (get(accessToken)) {
				if (!(await isAuthenticated(correlationID))) {
					return;
				}
				token = String(get(accessToken));
				authencated = true;

				si = await getSessionInfo(correlationID, false);

				try {
					const data = await authFetch(`${kanbanapiurl}board/is_favorited`, { board_id: id });
					board_favorited.set(data.favorited);
				} catch (e) {
					console.warn(e);
					showError(String(e));
				}
			}

			await fetchBoard();
			await fetchLists();
			await fetchCardsForAllLists();

			if (authencated && si && $boardMeta?.owner == si?.userId) {
				is_owner = true;
				can_edit = true;
			}

			if (authencated && si && !is_owner) {
				try {
					const data = await authFetch(`${kanbanapiurl}board/am_i_member`, { id });
					can_edit = data.result;
				} catch (e) {
					console.warn(e);
					showError(String(e));
				}
			}

			await setupWS(Number(id));
		} finally {
			loading = false;
		}
	});

	let socket: WebSocket;
	function setupWS(boardId: number) {
		const wsProtocol = kanbanapiurl.startsWith("https") ? "wss" : "ws";
		const wsUrl = `${wsProtocol}://${kanbanapiurl.replace(/^https?:\/\//, "")}board/live/${boardId}`;
		socket = new WebSocket(wsUrl);

		socket.onopen = () => console.log("WebSocket connected to board", boardId);

		socket.onmessage = (e) => {
			try {
				const payload = JSON.parse(e.data);
				console.log("Received WS update:", payload);

				switch (payload.type) {
					case "list_update":
						lists.set(payload.lists);
						break;

					case "card_update":
						cards.update((c) => ({
							...c,
							[payload.newListId]: payload.cards
						}));
						break;

					default:
						console.log("Unknown payload", payload);
				}
			} catch (err) {
				console.error("Failed to parse WS message", err);
			}
		};

		socket.onerror = (err) => console.error("WebSocket error", err);
		socket.onclose = () => console.log("WebSocket closed");
	}

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

	async function moveCard(e: CustomEvent<{ items: any[]; info?: any }>, sourceListId: string) {
		const updatedCards = e.detail.items;

		// Update local store immediately
		cards.update((c) => ({ ...c, [sourceListId]: updatedCards }));

		try {
			// Send updated positions to backend
			await Promise.all(
				updatedCards.map((card, index) =>
					authFetch(`${kanbanapiurl}card/move`, {
						card_id: card.id,
						list_id: sourceListId,
						position: index
					})
				)
			);
		} catch (err) {
			console.error("Failed to move cards:", err);
			showError("Failed to update card positions on server.");

			// Reset cards from backend
			await fetchCardsForAllLists();
		}
	}

	async function toggleFav(toggleto: boolean) {
		if (toggleto) {
			try {
				await authFetch(`${kanbanapiurl}board/favorite`, { board_id: id });
				board_favorited.set(toggleto);
				toast({
					title: "Favorited board",
					desc: $boardMeta?.name ?? id,
					icon: "family_star",
					appearance: "success",
					position: "bottom-left",
					autoDismiss: 5000
				});
			} catch (e) {
				console.warn(e);
				showError(String(e));
			}
		} else {
			try {
				await authFetch(`${kanbanapiurl}board/unfavorite`, { board_id: id });
				board_favorited.set(toggleto);
				toast({
					title: "Unfavorited board",
					desc: $boardMeta?.name ?? id,
					icon: "kid_star",
					appearance: "success",
					position: "bottom-left",
					autoDismiss: 5000
				});
			} catch (e) {
				console.warn(e);
				showError(String(e));
			}
		}
	}

	async function DeleteBoard() {
		try {
			await authFetch(`${kanbanapiurl}board/delete`, { board_id: id });
			toast({
				title: "Deleted board",
				desc: $boardMeta?.name ?? id,
				icon: "delete_forever",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			showBoardDelModal = false;
			goto("/");
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	}

	async function LeaveBoard() {
		await authFetch(`${kanbanapiurl}board/leave`, { board_id: id });
		toast({
			title: "Left board",
			desc: $boardMeta?.name ?? id,
			icon: "door_open",
			appearance: "success",
			position: "bottom-left",
			autoDismiss: 5000
		});
		showBoardLeaveModal = false;
		goto("/");
	}

	async function deleteList(list_id: number, list_name: string) {
		try {
			await authFetch(`${kanbanapiurl}list/delete`, { board_id: id, list_id });
			toast({
				title: "Deleted list",
				desc: list_name,
				icon: "delete_forever",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
		} catch (e) {
			console.warn(e);
			showError(String(e));
		} finally {
			await fetchLists();
		}
	}

	async function moveListLeft(list_id: number) {
		const currentLists = get(lists);
		const index = currentLists.findIndex((l) => Number(l.id) === list_id);
		if (index > 0) {
			// swap with the previous one
			const newOrder = [...currentLists];
			[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
			lists.set(newOrder);

			try {
				await authFetch(`${kanbanapiurl}list/move`, {
					board_id: id,
					lists: newOrder.map((l, idx) => ({ id: l.id, position: idx + 1 }))
				});
			} catch (err) {
				console.error("Failed to move list left:", err);
				showError("Failed to move list left on server.");
				await fetchLists();
			}
		}
	}

	async function moveListRight(list_id: number) {
		const currentLists = get(lists);
		const index = currentLists.findIndex((l) => Number(l.id) === list_id);
		if (index >= 0 && index < currentLists.length - 1) {
			// swap with the next one
			const newOrder = [...currentLists];
			[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
			lists.set(newOrder);

			try {
				await authFetch(`${kanbanapiurl}list/move`, {
					board_id: id,
					lists: newOrder.map((l, idx) => ({ id: l.id, position: idx + 1 }))
				});
			} catch (err) {
				console.error("Failed to move list right:", err);
				showError("Failed to move list right on server.");
				await fetchLists();
			}
		}
	}

	let openedCard: Card | null = $state(null);
	let BoardAccessOverlayOpen: boolean = $state(false);
</script>

{#if loading}
	<p class="loading-text">Loading board {$boardMeta?.name ?? id}.</p>
	<Loader />
	<p>Getting things ready.</p>
{:else if common_error}
	<Icon size="3rem;" color="var(--token-color-text-danger);" icon="crisis_alert" />
	<p class="loading-text">{common_error}</p>
	<LinkButton appearance="primary" href="/">My boards</LinkButton>
	<Space height="var(--token-space-3);" />
	<Button
		onClick={() => {
			history.back();
		}}>Back</Button
	>
{:else}
	<div class="board" style="background-image: url({$boardMeta?.background_url});">
		<nav id="board-nav">
			<div class="nav-left">
				<h2>{$boardMeta?.name ?? id}</h2>
				<Space width="var(--token-space-4)" />
				<Dropdown
					iconbefore="view_kanban"
					actions={[
						{ label: "Kanban", value: "kanban" },
						{ label: "Calendar", value: "calendar" }
					]}
					bind:value={view}
					appearance="subtle"
					alwaysshowslot
				>
					View
				</Dropdown>
			</div>
			<div class="nav-center"></div>
			<div class="nav-right">
				{#if $board_favorited}
					<IconButton
						appearance="warning"
						alt="Remove board from favorites."
						onClick={() => toggleFav(false)}
						icon="star_shine"
						disabled={!authencated}
					/>
				{:else}
					<IconButton
						appearance="subtle"
						alt="Add board to favorites."
						onClick={() => toggleFav(true)}
						icon="star"
						disabled={!authencated}
					/>
				{/if}

				{#if can_edit && !is_owner}
					<IconDropdown
						appearance="subtle"
						icon="more_horiz"
						alt="More actions."
						actions={[
							{
								label: "Leave board",
								onClick: () => {
									showBoardLeaveModal = true;
								}
							}
						]}
					/>
				{:else}
					<Button
						appearance="discover"
						iconbefore="group_add"
						onClick={() => {
							BoardAccessOverlayOpen = true;
						}}
						disabled={!is_owner}>Share</Button
					>
					<IconDropdown
						appearance="subtle"
						icon="more_horiz"
						alt="More actions."
						disabled={!is_owner}
						actions={[
							{
								label: "Delete board",
								onClick: () => {
									showBoardDelModal = true;
								}
							},
							{
								label: "Edit board",
								onClick: () => {
									goto("/board/" + id + "/edit");
								}
							},
							{
								label: "Change background",
								onClick: () => {
									// goto("/board/" + id + "/background")
								}
							}
						]}
					/>
				{/if}
			</div>
		</nav>
		{#if view === "kanban"}
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
				onconsider={(e) => lists.set(e.detail.items)}
				onfinalize={moveList}
			>
				{#each $lists as list (list.id)}
					<div class="list">
						<div class="list-header">
							<h3 class="list-title">{list.name}</h3>
							<IconDropdown
								appearance="subtle"
								icon="more_horiz"
								alt="More actions."
								disabled={!can_edit}
								actions={[
									{
										label: "Delete list",
										onClick: () => {
											deleteList(Number(list.id), list.name);
										}
									},
									{
										label: "Move left",
										onClick: () => {
											moveListLeft(Number(list.id));
										}
									},
									{
										label: "Move right",
										onClick: () => {
											moveListRight(Number(list.id));
										}
									}
								]}
							/>
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
							onconsider={(e) => cards.update((c) => ({ ...c, [list.id]: e.detail.items }))}
							onfinalize={(e) => moveCard(e, list.id)}
						>
							{#each $cards[list.id] ?? [] as card (card.id)}
								<div
									class="card"
									data-id={card.id}
									Onclick={() => {
										openedCard = card;
									}}
								>
									{card.name}
								</div>
							{/each}

							{#if $addingCard[list.id]}
								<input
									class="card new-card-input"
									bind:value={$newCardText[list.id]}
									placeholder="Enter card title..."
									onkeydown={(e) => e.key === "Enter" && confirmNewCard(list.id)}
									onblur={() => confirmNewCard(list.id)}
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
							onkeydown={(e) => e.key === "Enter" && confirmNewList()}
							onblur={confirmNewList}
							use:autoFocusInput
						/>
					{:else}
						<Button appearance="subtle" onClick={() => addingList.set(true)}>Add list</Button>
					{/if}
				</div>
			</div>
		{:else if view === "calendar"}
			<div class="lists">
				{#if CalendarListID}
					<div class="list">
						<FlexWrapper width="100%">
							<Dropdown
								appearance="subtle"
								bind:value={CalendarListID}
								actions={$lists.length > 0
									? $lists.map((l) => ({ label: l.name, value: l.id }))
									: [{ label: "No lists available", value: null }]}
							/>
						</FlexWrapper>
						<div class="cards">
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							{#each $cards[CalendarListID] ?? [] as card (card.id)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<div class="card">
									{card.name}
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<p>Please select a list to view its cards.</p>
				{/if}
				<div class="list">
					<FlexWrapper width="100%">
						<h1>Loading Calendar</h1>
						<Loader />
					</FlexWrapper>
				</div>
			</div>
		{:else}
			<h1>Unhandled view.</h1>
			<Loader />
		{/if}
	</div>
{/if}

{#if showBoardDelModal}
	<Modal
		title="Delete board {$boardMeta?.name ?? id}?"
		titleIcon="delete_forever"
		desc="This cannot be undone?"
		hasCloseBtn
		on:close={() => (showBoardDelModal = false)}
		options={[
			{
				appearance: "subtle",
				content: "Cancel",
				onClick: () => (showBoardDelModal = false)
			},
			{ appearance: "danger", content: "Delete board", onClick: DeleteBoard }
		]}
	/>
{/if}

{#if showBoardLeaveModal}
	<Modal
		title="Leave board {$boardMeta?.name ?? id}?"
		titleIcon="door_open"
		desc="You cannot come back until the owner invites you again."
		hasCloseBtn
		on:close={() => (showBoardLeaveModal = false)}
		options={[
			{
				appearance: "subtle",
				content: "Cancel",
				onClick: () => (showBoardLeaveModal = false)
			},
			{ appearance: "danger", content: "Leave board", onClick: LeaveBoard }
		]}
	/>
{/if}

{#if openedCard}
	<CardOverlay
		closeOverlay={() => {
			openedCard = null;
		}}
		{openedCard}
		{correlationID}
	/>
{/if}

{#if BoardAccessOverlayOpen}
	<BoardAccess
		closeOverlay={() => {
			BoardAccessOverlayOpen = false;
		}}
		{correlationID}
		boardOwner={$boardMeta?.owner}
		boardId={Number(id)}
	/>
{/if}

<style>
	#board-nav {
		height: 48px;
		width: calc(100% - 3rem);
		background: rgba(103, 155, 151, 0.21);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		padding: 4px;
		color: #fff;
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.5rem;
		z-index: 5;
	}

	#board-nav > div {
		flex: 1;
		display: flex;
		align-items: center;
	}

	.nav-left h2 {
		margin: 0px;
	}

	.nav-center {
		justify-content: center;
	}

	.nav-right {
		justify-content: flex-end;
		gap: 0.5rem;
	}

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
		padding-bottom: 1rem;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
	}
	.lists {
		display: flex;
		gap: 1.5rem;
		overflow-x: auto;
		padding: 1.5rem;
		flex-grow: 1;
		scroll-behavior: smooth;
	}
	.list {
		background: var(--token-color-surface-sunken-normal);
		min-width: 250px;
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
		position: relative; /* allows absolute positioning of button */
		display: flex;
		align-items: center; /* vertical center */
		justify-content: center; /* centers the title */
		padding: 0.5rem; /* optional spacing inside the header */
	}

	.list-title {
		margin: 0px;
		text-align: center;
		flex: 1;
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
		color: var(--token-color-text-default-secondary);
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
