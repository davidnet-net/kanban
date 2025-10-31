<script lang="ts">
	import { kanbanapiurl } from "$lib/config";
	import {
		FlexWrapper,
		Icon,
		IconButton,
		LinkButton,
		LinkIconButton,
		Loader,
		Modal,
		Space,
		toast,
		wait,
		authFetch,
		getSessionInfo
	} from "@davidnet/svelte-ui";
	import type { Board, SessionInfo } from "$lib/types";
	import { onMount } from "svelte";

	import {_} from 'svelte-i18n';
	
	let loading = $state(true);
	let correlationID = crypto.randomUUID();
	let si: SessionInfo | null = $state(null);
	let zeroboards = $state(true);

	let recent_boards: Board[] = $state([]);
	let boards: Board[] = $state([]);
	let shared_boards: Board[] = $state([]);
	let favorite_boards: Board[] = $state([]);

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
		si = await getSessionInfo(correlationID, true);
		if (!si) {
			showError("Session Invalid.");
			return;
		}

		try {
			const res = await authFetch(`${kanbanapiurl}boards/list`, correlationID, { method: "GET" });
			boards = await res.json();

			const favorite_boards_res = await authFetch(`${kanbanapiurl}boards/favorites`, correlationID, { method: "GET" });
			favorite_boards = await favorite_boards_res.json();

			const recent_boards_res = await authFetch(`${kanbanapiurl}boards/recent`, correlationID, { method: "GET" });
			recent_boards = await recent_boards_res.json();

			const shared_boards_res = await authFetch(`${kanbanapiurl}boards/shared_with_me`, correlationID, { method: "GET" });
			shared_boards = await shared_boards_res.json();

			zeroboards = boards.length === 0 && shared_boards.length === 0;

			await wait(200);
			loading = false;
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	});

	let showClearResetBoardsModal = $state(false);
	async function clearrecentboards() {
		showClearResetBoardsModal = false;

		try {
			const res = await authFetch(`${kanbanapiurl}boards/clear_recent`, correlationID, { method: "POST" });
			if (!res.ok) throw new Error(`Server responded with ${res.status}`);

			recent_boards = [];
			toast({
				title: "Recent boards cleared",
				icon: "auto_delete",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 3000
			});
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	}
</script>

{#if loading}
	<Loader />
	<p>{$_('kanban.loading', { values: { display_name: si?.display_name}})}</p>
{:else}
	<FlexWrapper justifycontent="flex-start" alignitems="flex-start" direction="column" gap="var(--token-space-2)" width="100%" height="100%">
		{#if zeroboards}
			<div class="no-boards">
				<Icon icon="iframe_off" size="5rem" color="var(--token-color-text-warning)" />
				<p>You don't have any boards yet.<br />Create one to get started!</p>
				<LinkButton appearance="primary" href="/board/create">Create Board</LinkButton>
				<LinkButton appearance="subtle" href="/invites">Your invites</LinkButton>
			</div>
		{:else}
			<Space height="var(--token-space-6)" />
			<div class="section">
				<LinkButton appearance="primary" href="/board/create">Create Board</LinkButton>
				<LinkButton appearance="subtle" href="/invites">Invites</LinkButton>
				<LinkIconButton
					icon="source_notes"
					appearance="subtle"
					href="https://github.com/davidnet-net/kanban/commits/main/"
					alt="Update history"
				/>
				<IconButton
					icon="auto_delete"
					appearance="subtle"
					alt="Delete recent boards"
					onClick={() => {
						showClearResetBoardsModal = true;
					}}
				/>
			</div>

			<div class="section">
				<h2 class="section-title">Recent boards:</h2>
				{#if recent_boards.length > 0}
					<div class="boards-grid">
						{#each recent_boards as board (board.id)}
							<a href={"/board/" + board.id} class="board-link">
								<div class="board-card">
									<img src={board.background_url} alt="Board background" aria-hidden="true" />
									<div class="board-info">
										<h3>{board.name}</h3>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<p class="no-boards-section">You did not visit an board recently.</p>
				{/if}
			</div>

			<div class="section">
				<h2 class="section-title">Favorite boards:</h2>
				{#if favorite_boards.length > 0}
					<div class="boards-grid">
						{#each favorite_boards as board (board.id)}
							<a href={"/board/" + board.id} class="board-link">
								<div class="board-card">
									<img src={board.background_url} alt="Board background" aria-hidden="true" />
									<div class="board-info">
										<h3>{board.name}</h3>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<p class="no-boards-section">You have not yet favorited an board.</p>
				{/if}
			</div>

			<div class="section">
				<h2 class="section-title">Your boards:</h2>
				{#if boards.length > 0}
					<div class="boards-grid">
						{#each boards as board (board.id)}
							<a href={"/board/" + board.id} class="board-link">
								<div class="board-card">
									<img src={board.background_url} alt="Board background" aria-hidden="true" />
									<div class="board-info">
										<h3>{board.name}</h3>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<p class="no-boards-section">You have not yet created an board.</p>
				{/if}
			</div>

			<!-- Shared boards -->
			<div class="section">
				<h2 class="section-title">Boards shared with you:</h2>
				{#if shared_boards.length > 0}
					<div class="boards-grid">
						{#each shared_boards as board (board.id)}
							<a href={"/board/" + board.id} class="board-link">
								<div class="board-card">
									<img src={board.background_url} alt="Board background" aria-hidden="true" />
									<div class="board-info">
										<h3>{board.name}</h3>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<p class="no-boards-section">No boards are shared with you.</p>
				{/if}
			</div>
		{/if}
	</FlexWrapper>
{/if}

{#if showClearResetBoardsModal}
	<Modal
		title="Clear recent boards list?"
		titleIcon="auto_delete"
		desc="This cannot be undone?"
		hasCloseBtn
		on:close={() => (showClearResetBoardsModal = false)}
		options={[
			{
				appearance: "subtle",
				content: "Cancel",
				onClick: () => (showClearResetBoardsModal = false)
			},
			{ appearance: "danger", content: "Clear recent boards", onClick: clearrecentboards }
		]}
	/>
{/if}

<style>
	/* Sections */
	.section {
		width: 100%;
		max-width: 1000px;
		margin: var(--token-space-4) auto;
	}

	.section-title {
		font-size: 1.1rem;
		font-weight: 500;
		margin-bottom: var(--token-space-2);
		text-align: left;
	}

	.no-boards-section {
		text-align: left;
		color: var(--token-color-text-default-tertiary);
		margin-top: var(--token-space-2);
	}

	/* Boards Grid */
	.boards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--token-space-3);
		margin: var(--token-space-2) auto;
		width: 100%;
		max-width: 1000px;
	}

	.board-link {
		color: var(--token-color-text-default-normal);
		text-decoration: none;
	}

	.board-card {
		position: relative;
		display: flex;
		flex-direction: column;
		border-radius: 1rem;
		overflow: hidden;
		cursor: pointer;
		background: var(--token-color-surface-raised-normal);
		transition:
			transform 0.3s ease,
			box-shadow 0.3s ease;
	}

	.board-card:hover {
		transform: translateY(-4px);
		background: var(--token-color-surface-raised-hover);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
	}

	.board-card img {
		width: 100%;
		height: 120px;
		object-fit: cover;
	}

	.board-info {
		padding: var(--token-space-3);
		background: var(--token-color-surface-raised-normal);
	}

	.board-info h3 {
		font-size: 1.1rem;
		margin: 0;
	}

	/* Empty state */
	.no-boards {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		gap: var(--token-space-3);
		margin-top: var(--token-space-6);
		text-align: center;
	}

	.no-boards p {
		font-size: 1.1rem;
		line-height: 1.4;
	}
</style>
