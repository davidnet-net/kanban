<script lang="ts">
	import { authapiurl, kanbanapiurl } from "$lib/config";
	import type { Card, ProfileResponse } from "$lib/types";
	import { Button, FlexWrapper, IconButton, Loader, TextField, toast, accessToken, formatDate_PREFERREDTIME } from "@davidnet/svelte-ui";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import { marked } from "marked";
	import { _ } from "svelte-i18n";

	let { closeOverlay, openedCard, correlationID, board_id } = $props<{
		closeOverlay: () => void;
		openedCard: Card;
		correlationID: string;
		board_id: number;
	}>();

	let creation_date: string = $state("");
	let owner: ProfileResponse | null = $state(null);
	let loaded = $state(false);
	let addchecklist: string | undefined = $state(undefined);
	let showchecklist = $state(false);

	onMount(async () => {
		creation_date = await formatDate_PREFERREDTIME(openedCard.created_at, correlationID);
		owner = await fetchProfile(openedCard.owner);

		if (!owner) {
			return;
		}

		if (!creation_date || creation_date === "") {
			return;
		}

		loaded = true;
	});

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

	async function fetchProfile(id: number) {
		const token = get(accessToken);
		try {
			const res = await fetch(`${authapiurl}profile/${id}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					"x-correlation-id": correlationID,
					Authorization: `Bearer ${token}`
				},
				credentials: "include"
			});

			if (!res.ok) {
				toast({
					title: $_('kanban.components.cardoverlay.error.profile_load_error_title'),
					desc: $_('kanban.components.cardoverlay.error.profile_load_error_desc'),
					icon: "crisis-alert",
					appearance: "danger",
					position: "top-center",
					autoDismiss: 5000
				});
			}

			const data = await res.json();
			return data;
		} catch (err) {
			console.error("fetchProfile error:", err);
			toast({
				title: $_('kanban.components.cardoverlay.error.network_error_title'),
				desc: $_('kanban.components.cardoverlay.error.network_error_desc'),
				icon: "crisis-alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
		}
	}

	let editing = $state(false);
	let description = $state(openedCard.description ?? "");

	async function saveDescription() {
		try {
			await authFetch(kanbanapiurl + "card/change-description", { card_id: openedCard.id, description: description });
			toast({
				title: $_('kanban.components.cardoverlay.toast.card_updated_title'),
				desc: $_('kanban.components.cardoverlay.toast.card_updated_desc'),
				icon: "check",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 3000
			});
		} catch {
			toast({
				title: $_('kanban.components.cardoverlay.toast.card_update_failed_title'),
				desc: $_('kanban.components.cardoverlay.toast.card_update_failed_desc'),
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 3000
			});
		}
		editing = false;
	}

	async function deletecard() {
		try {
			await authFetch(kanbanapiurl + "card/delete", { card_id: openedCard.id, board_id: board_id });
			toast({
				title: $_('kanban.components.cardoverlay.toast.card_deleted_title'),
				desc: "",
				icon: "delete_forever",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 3000
			});
			closeOverlay();
		} catch {
			toast({
				title: $_('kanban.components.cardoverlay.toast.card_deletion_failed_title'),
				desc: $_('kanban.components.cardoverlay.toast.card_deletion_failed_desc'),
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 3000
			});
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			saveDescription();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="blanket" onclick={(e) => e.target === e.currentTarget && closeOverlay()} tabindex="-1" aria-modal="true">
	<div class="content">
		{#if loaded}
			<header class="header">
				<h2>{openedCard.name}</h2>
				<div>
					<IconButton icon="help" disabled appearance="subtle" onClick={() => {}} alt={$_('kanban.components.cardoverlay.alt.about_cards')} />
					<IconButton icon="delete_forever" appearance="danger" onClick={deletecard} alt={$_('kanban.components.cardoverlay.alt.delete_card')} />
					<IconButton icon="close" appearance="primary" onClick={closeOverlay} alt={$_('kanban.components.cardoverlay.alt.close')} />
				</div>
			</header>

			<div class="container">
				<div class="card-body">
					<div class="action-bar">
						<Button onClick={() => {}} iconbefore="new_label">{$_('kanban.components.cardoverlay.btn.add_label')}</Button>
						<Button onClick={() => {}} iconbefore="calendar_clock">{$_('kanban.components.cardoverlay.btn.dates')}</Button>
						<Button
							onClick={() => {
								showchecklist = true;
							}}
							iconbefore="checklist">{$_('kanban.components.cardoverlay.btn.add_checklist')}</Button>
						<Button onClick={() => {}} iconbefore="attach_file_add">{$_('kanban.components.cardoverlay.btn.add_attachment')}</Button>
					</div>

					<div class="meta-bar">
						<div><bold>{$_('kanban.components.cardoverlay.label.created_at')}</bold><br />{creation_date}</div>

						{#if owner!.profile.display_name === owner!.profile.username}
							<div><bold>{$_('kanban.components.cardoverlay.label.created_by')}</bold><br />@{owner!.profile.username}</div>
						{:else}
							<div>
								<bold>{$_('kanban.components.cardoverlay.label.created_by')}</bold><br />{owner!.profile.display_name} <span class="secondary">@{owner!.profile.username}</span>
							</div>
						{/if}
					</div>

					<div class="description">
						<h4>{$_('kanban.components.cardoverlay.section.description')}</h4>
						{#if editing}
							<textarea
								bind:value={description}
								onkeydown={handleKey}
								class="description-input"
								placeholder={$_('kanban.components.cardoverlay.placeholder.write_description')}
								rows="4"
							></textarea>
							<div class="actions">
								<Button appearance="primary" onClick={saveDescription}>{$_('kanban.components.cardoverlay.btn.save')}</Button>
								<Button appearance="subtle" onClick={() => (editing = false)}>{$_('kanban.components.cardoverlay.btn.cancel')}</Button>
							</div>
						{:else}
							<div class="description-preview" onclick={() => (editing = true)}>
								{@html marked(description || $_('kanban.components.cardoverlay.placeholder.add_detailed_description'))}
							</div>
						{/if}
					</div>

					{#if showchecklist}
						<div>
							<h4>{$_('kanban.components.cardoverlay.section.checklist')}</h4>
							<div class="checklist-adder">
								<FlexWrapper direction="row" gap="var(--token-space-3);">
									<TextField
										label={$_('kanban.components.cardoverlay.field.checklist_item_label')}
										type="text"
										placeholder={$_('kanban.components.cardoverlay.field.checklist_item_placeholder')}
										bind:value={addchecklist}
										invalid={false}
										invalidMessage={$_('kanban.components.cardoverlay.field.checklist_item_invalid')}
										width="85%"
									/>
									<IconButton icon="add" onClick={() => {}} alt={$_('kanban.components.cardoverlay.alt.add_checklist_item')} appearance="primary" />
								</FlexWrapper>
							</div>
						</div>
					{/if}
				</div>

				<div class="activity-container">
					<h3>{$_('kanban.components.cardoverlay.section.activity_comments')}</h3>
					<div class="activity">
						<img crossorigin="anonymous" src="https://account.davidnet.net/placeholder.png" aria-hidden="true" alt="" />
						<a href="https://account.davidnet.net/profile/{openedCard.owner}">{owner!.profile.display_name}</a>
						{$_('kanban.components.cardoverlay.text.created_card_on', {values: {date: creation_date}})}<br />
					</div>
				</div>
			</div>
		{:else}
			<FlexWrapper width="100%">
				<Loader />
			</FlexWrapper>
		{/if}
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
		height: 500px;
		overflow-y: scroll;
	}

	.activity-container {
		text-align: center;
		background-color: var(--token-color-surface-raised-normal);
		width: 50%;
		padding: 1rem;
		padding-top: 0rem;
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
		color: var(--token-color-text-default-normal);
		gap: 1rem;
		line-height: 1.2;
		text-align: left;
	}

	.activity a {
		color: var(--token-color-text-default-normal);
	}

	.activity a:hover {
		color: var(--token-color-text-default-secondary);
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

	.meta-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 1rem;
		justify-content: space-around;
		align-items: center;
		line-height: 1.5;
		text-align: center;
		width: 80%;
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

	.secondary {
		color: var(--token-color-text-default-secondary);
	}
	.description {
		margin-top: 1rem;
	}

	.description h4 {
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--token-color-text-default-secondary);
	}

	.description-input {
		width: 85%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: var(--token-color-surface-overlay-normal);
		color: var(--token-color-text-default-normal);
		resize: vertical;
		font-family: inherit;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.description-preview {
		color: var(--token-color-text-default-normal);
		line-height: 1.5;
		white-space: pre-wrap;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.25rem 0;
		margin: 0px;
		height: fit-content;
	}

	.actions {
		margin-top: 0.5rem;
		display: flex;
		gap: 0.5rem;
	}
</style>
