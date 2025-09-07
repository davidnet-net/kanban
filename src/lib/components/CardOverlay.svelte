<script lang="ts">
	import type { Card } from "$lib/types";
	import { Button, IconButton, Space } from "@davidnet/svelte-ui";

	export let closeCard;
	export let openedCard: Card;
</script>

<div class="overlay" Onclick={closeCard}>
	<div class="content">
		<header class="header">
			<h2>{openedCard.name}</h2>
			<div>
				<IconButton icon="help" appearance="subtle" onClick={() => {}} alt="About cards." />
				<IconButton icon="archive" appearance="danger" onClick={() => {}} alt="Archive." />
				<IconButton icon="close" appearance="primary" onClick={closeCard} alt="Close." />
			</div>
		</header>

		<div class="container">
			<div class="card-body">
				<div class="action-bar">
					<Button onClick={() => {}} iconbefore="new_label">Add label</Button>
					<Button onClick={() => {}} iconbefore="calendar_clock">Dates</Button>
					<Button onClick={() => {}} iconbefore="checklist">Add checklist</Button>
					<Button onClick={() => {}} iconbefore="attach_file_add">Add attachment</Button>
				</div>
				<Space height="var(--token-space-3)" />
				<p><strong>ID:</strong> {openedCard.id}</p>
				<p><strong>Created at:</strong> {openedCard.created_at}</p>
				<p><strong>Is Archived:</strong> {openedCard.is_archived}</p>
				<p><strong>Name:</strong> {openedCard.name}</p>
				<p><strong>Owner:</strong> {openedCard.owner}</p>
				<Space height="var(--token-space-6)" />
				<Space height="var(--token-space-6)" />
				<Space height="var(--token-space-6)" />
			</div>
			<div class="activity-container">
				<h1>Activity & Comments</h1>
				<div class="activity">
                    <img src="https://account.davidnet.net/placeholder.png" alt="test">
                    <a href="/a">David</a> created card on Sep 7 14:53
                </div>
			</div>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.container {
		display: flex;
		flex-direction: row;
	}

	.content {
		background: var(--token-color-surface-overlay-normal);
		border-radius: 12px;
		width: 800px;
		max-width: 95%;
		max-height: 90vh;
		overflow-y: auto;
		padding: 1.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
	}

	.card-body {
		width: 50%;
		gap: 1rem;
	}

	.activity-container {
		text-align: center;
		background-color: var(--token-color-surface-raised-normal);
		width: 50%;
        padding: 1rem;
	}

	.activity {
		background-color: var(--token-color-surface-overlay-normal);
        padding: 1rem;
        border-radius: 1rem;
        vertical-align: middle;
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        gap: 1rem;
	}

    .activity img {
        border-radius: 50%;
        height: 1.5rem;
        width: 1.5rem;
    }

    .activity:hover {
        background-color: var(--token-color-surface-overlay-hover);
        transform: scale(1.01);
    }

	.action-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 1rem;
		justify-content: flex-start;
		align-items: center;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: 0.5rem;
	}

	.header h2 {
		margin: 0;
		font-size: 1.25rem;
	}
</style>
