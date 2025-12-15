<script lang="ts">
	import { kanbanapiurl } from "$lib/config";
	import type { Card } from "$lib/types";
	import { Button, IconButton, TextField, toast, accessToken, Space, Icon, Dropdown, FlexWrapper } from "@davidnet/svelte-ui";
	import { get } from "svelte/store";
	import { _ } from "svelte-i18n";

	let {
		closeOverlay,
		onCardSelect,
		date,
		allCards,
		lists,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		correlationID,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		board_id
	} = $props<{
		closeOverlay: () => void;
		onCardSelect: (card: Card) => void;
		date: Date;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		allCards: { [listId: string]: Card[] };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		lists: any[];
		correlationID: string;
		board_id: number;
	}>();

	// --- State ---
	let activeTab: "create" | "existing" = $state("create");
	let newCardName: string = $state("");
	let selectedListId: string = $state("");

	// Search & Filter state for existing cards
	let filterListId: string = $state(""); // "" means All Lists
	let searchQuery = $state("");
	let loadingAction = $state(false);

	// --- Derived ---

	// Format the date for the header
	const formattedDate = $derived(
		new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(date)
	);

	const dateKey = $derived(getDateKey(date));

	// Calculate which cards are currently on this day
	const cardsOnDay = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const flatCards = Object.values(allCards).flat();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return flatCards.filter((card: any) => {
			// Logic matches the calendar view:
			// 1. Range (Start <= Date <= Due)
			// 2. Exact Match (Due == Date OR Start == Date)

			if (!card.start_date && !card.due_date) return false;

			const targetKey = dateKey;

			if (card.start_date && card.due_date) {
				const s = getDateKey(new Date(card.start_date));
				const e = getDateKey(new Date(card.due_date));
				return targetKey >= s && targetKey <= e;
			} else if (card.due_date) {
				return getDateKey(new Date(card.due_date)) === targetKey;
			} else if (card.start_date) {
				return getDateKey(new Date(card.start_date)) === targetKey;
			}
			return false;
		});
	});

	// --- Dropdown Options & Labels ---

	// Generic list options for Dropdowns
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const listOptions = $derived(lists.map((l: any) => ({ label: l.name, value: l.id })));

	// 1. For "Create New" Tab
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const selectedListName = $derived(
		lists.find((l: any) => l.id === selectedListId)?.name || $_("kanban.components.dayoverlay.field.list_select.label")
	);

	// 2. For "Add Existing" Tab (Filter)
	const filterOptions = $derived([{ label: $_("kanban.components.dayoverlay.field.filter_list.all_lists"), value: "" }, ...listOptions]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const filterListName = $derived(
		filterListId === "" ? $_("kanban.components.dayoverlay.field.filter_list.all_lists") : lists.find((l: any) => l.id === filterListId)?.name
	);

	// --- Filtering Logic ---
	const searchResults = $derived.by(() => {
		if (activeTab !== "existing") return [];

		const query = searchQuery.toLowerCase().trim();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let candidates: any[] = [];

		// 1. Filter by List (or get all)
		if (filterListId === "") {
			candidates = Object.values(allCards).flat();
		} else {
			candidates = allCards[filterListId] ?? [];
		}

		// 2. Filter logic
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return candidates
			.filter((c: any) => {
				// Requirement: Exclude cards that ALREADY have a date
				if (c.start_date || c.due_date) return false;

				// Search Query
				if (query && !c.name.toLowerCase().includes(query)) return false;

				return true;
			})
			.slice(0, 50); // Limit results for performance
	});

	// Initialize selected list for creation
	$effect(() => {
		if (lists.length > 0 && !selectedListId) {
			selectedListId = lists[0].id;
		}
	});

	// --- Helpers ---

	function getDateKey(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
	}

	const token = String(get(accessToken));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

	// --- Actions ---

	async function createNewCard() {
		if (!newCardName.trim() || !selectedListId) return;
		loadingAction = true;

		try {
			// 1. Create the card
			const newCard = await authFetch(`${kanbanapiurl}card/add`, {
				list_id: selectedListId,
				name: newCardName
			});

			// 2. Set the date (Defaulting to Due Date for the day clicked)
			await authFetch(`${kanbanapiurl}card/change-dates`, {
				card_id: newCard.id,
				due_date: dateKey // backend usually accepts YYYY-MM-DD
			});

			toast({
				title: $_("kanban.components.dayoverlay.toast.card_created.title"),
				desc: $_("kanban.components.dayoverlay.toast.card_created.desc", { values: { card_name: newCardName, date: formattedDate } }),
				icon: "check",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 3000
			});

			newCardName = ""; // Reset input
		} catch (e) {
			console.error(e);
			toast({
				title: $_("kanban.components.dayoverlay.error.create_failed"),
				desc: String(e),
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 4000
			});
		} finally {
			loadingAction = false;
		}
	}

	async function attachExistingCard(card: Card) {
		loadingAction = true;
		try {
			// We set Due Date to this day.
			await authFetch(`${kanbanapiurl}card/change-dates`, {
				card_id: card.id,
				due_date: dateKey
			});

			toast({
				title: $_("kanban.components.dayoverlay.toast.card_rescheduled.title"),
				desc: $_("kanban.components.dayoverlay.toast.card_rescheduled.desc", { values: { card_name: card.name, date: formattedDate } }),
				icon: "calendar_month",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 3000
			});

			searchQuery = ""; // Reset search
		} catch (e) {
			console.error(e);
			toast({
				title: $_("kanban.components.dayoverlay.error.update_failed"),
				desc: String(e),
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 4000
			});
		} finally {
			loadingAction = false;
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="blanket" onclick={(e) => e.target === e.currentTarget && closeOverlay()} tabindex="-1" aria-modal="true">
	<div class="content">
		<header class="header">
			<h2>{formattedDate}</h2>
			<div>
				<IconButton icon="close" appearance="primary" onClick={closeOverlay} alt={$_("kanban.components.cardoverlay.alt.close")} />
			</div>
		</header>

		<div class="body-grid">
			<div class="section existing-section">
				<h3>{$_("kanban.components.dayoverlay.section.cards_on_day", { values: { count: cardsOnDay.length } })}</h3>
				<div class="card-list">
					{#if cardsOnDay.length === 0}
						<div class="empty-state">
							<Icon icon="event_busy" size="2rem" color="var(--token-color-text-default-secondary)" />
							<p>{$_("kanban.components.dayoverlay.text.no_cards")}</p>
						</div>
					{:else}
						{#each cardsOnDay as card ((card as Card).id)}
							<Button
								appearance="subtle"
								stretchwidth
								justifycontent="space-between"
								iconafter="chevron_right"
								onClick={() => onCardSelect(card)}
							>
								<span class="card-name-truncate">{(card as Card).name}</span>
							</Button>
						{/each}
					{/if}
				</div>
			</div>

			<div class="section add-section">
				<div class="tabs">
					<Button appearance={activeTab === "create" ? "primary" : "subtle"} onClick={() => (activeTab = "create")} stretchwidth>
						{$_("kanban.components.dayoverlay.tab.create_new")}
					</Button>
					<Button appearance={activeTab === "existing" ? "primary" : "subtle"} onClick={() => (activeTab = "existing")} stretchwidth>
						{$_("kanban.components.dayoverlay.tab.add_existing")}
					</Button>
				</div>

				<div class="tab-content">
					{#if activeTab === "create"}
						<div class="create-form">
							<TextField
								label={$_("kanban.components.dayoverlay.field.card_title.label")}
								placeholder={$_("kanban.components.dayoverlay.field.card_title.placeholder")}
								bind:value={newCardName}
								onEnter={createNewCard}
								width="100%"
							/>

							<Space height="var(--token-space-2)" />

							<label class="label" for="list-select">{$_("kanban.components.dayoverlay.field.list_select.label")}</label>

							<div class="dropdown-container">
								<Dropdown actions={listOptions} bind:value={selectedListId} appearance="subtle" alwaysshowslot>
									{selectedListName}
								</Dropdown>
							</div>

							<Space height="var(--token-space-2)" />

							<div class="actions-right">
								<Button
									appearance="primary"
									onClick={createNewCard}
									disabled={!newCardName.trim() || loadingAction}
									iconbefore={loadingAction ? "sync" : "add"}
								>
									{loadingAction ? $_("kanban.components.dayoverlay.btn.creating") : $_("kanban.components.dayoverlay.btn.create")}
								</Button>
							</div>
						</div>
					{:else}
						<div class="existing-form">
							<TextField
								label={$_("kanban.components.dayoverlay.field.search.label")}
								placeholder={$_("kanban.components.dayoverlay.field.search.placeholder")}
								bind:value={searchQuery}
								width="100%"
							/>

							<div>
								<Space height="var(--token-space-2)" />
								<label class="label" for="filter-list">{$_("kanban.components.dayoverlay.field.filter_list.label")}</label>

								<div class="dropdown-container">
									<Dropdown actions={filterOptions} bind:value={filterListId} appearance="subtle" alwaysshowslot>
										{filterListName}
									</Dropdown>
								</div>
							</div>

							<div class="search-results">
								{#each searchResults as card ((card as Card).id)}
									<div class="search-item">
										<span class="search-name">{(card as Card).name}</span>
										<Button appearance="subtle" onClick={() => attachExistingCard(card as Card)} disabled={loadingAction}>
											{$_("kanban.components.dayoverlay.btn.add")}
										</Button>
									</div>
								{:else}
									<div class="empty-results">
										{$_("kanban.components.dayoverlay.text.no_results")}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.blanket {
		position: fixed;
		inset: 0;
		background-color: var(--token-color-blanket-normal);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 900;
	}

	.content {
		background: var(--token-color-surface-overlay-normal);
		border-radius: 12px;
		width: 700px; /* Slightly narrower than CardOverlay */
		max-width: 95%;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: 0.5rem;
		margin-bottom: 1rem;
	}

	.header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--token-color-text-default);
	}

	.body-grid {
		display: flex;
		gap: 1.5rem;
		height: 400px; /* Fixed height for inner scrolling */
	}

	.section {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	h3 {
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--token-color-text-default-secondary);
		margin-top: 0;
		margin-bottom: 0.75rem;
	}

	/* Left Column Styles */
	.card-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-right: 0.5rem;
	}

	/* Helper class to truncate text inside the Button */
	.card-name-truncate {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
		max-width: 100%;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--token-color-text-default-secondary);
		font-size: 0.9rem;
		opacity: 0.7;
	}

	/* Right Column (Tabs) Styles */
	.add-section {
		background: var(--token-color-surface-sunken-normal);
		border-radius: 8px;
		padding: 1rem;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		border-bottom: 2px solid rgba(255, 255, 255, 0.05);
		padding-bottom: 0.5rem;
	}

	.tab-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.create-form,
	.existing-form {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--token-color-text-default);
		margin-bottom: 0.4rem;
		display: block;
	}

	.dropdown-container {
		width: 100%;
		display: flex;
	}

	/* Ensuring dropdown inside flex container behaves nicely if needed */
	.dropdown-container :global(button) {
		width: 100%;
		justify-content: space-between;
		background: var(--token-color-surface-raised-normal);
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.actions-right {
		display: flex;
		justify-content: flex-end;
		margin-top: auto;
	}

	.search-results {
		flex: 1;
		overflow-y: auto;
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.search-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		background: var(--token-color-surface-raised-normal);
		border-radius: 4px;
		gap: 0.5rem;
	}

	.search-name {
		font-size: 0.9rem;
		color: var(--token-color-text-default-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty-results {
		text-align: center;
		color: var(--token-color-text-default-secondary);
		font-size: 0.85rem;
		margin-top: 1rem;
	}
</style>
