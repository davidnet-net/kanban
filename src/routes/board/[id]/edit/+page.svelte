<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { kanbanapiurl } from "$lib/config";
	import { Button, Dropdown, FlexWrapper, Space, TextField, toast, authFetch } from "@davidnet/svelte-ui";
	import { onMount } from "svelte";
	import { _ } from "svelte-i18n";

	let boardId = Number(page.params.id);
	let boardname: string = "";
	let visibility = "private";

	const correlationID = crypto.randomUUID();
	let boardname_invalid = false;
	let busy = false;
	let initialName = "";
	let initialVisibility = "";

	const visibilityOptions = [
		{ label: $_("kanban.board.id.edit.option.private"), value: "private" },
		{ label: $_("kanban.board.id.edit.option.public"), value: "public" }
	];

	// Fetch board details on mount
	onMount(async () => {
		try {
			const res = await authFetch(`${kanbanapiurl}board/get`, correlationID, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: boardId })
			});
			if (!res.ok) {
				console.warn("Failed to fetch board");
				return;
			}
			const board = await res.json();
			boardname = board.name;
			initialName = board.name;
			visibility = board.is_public ? "public" : "private";
			initialVisibility = visibility;
		} catch (err) {
			toast({
				title: $_("kanban.board.id.edit.error.something_failed"),
				desc: "Error: " + err,
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
			console.warn("Error fetching board:", err);
		}
	});

	// Whether button should be disabled
	$: noChanges = boardname === initialName && visibility === initialVisibility;

	async function editBoard() {
		boardname_invalid = !boardname || boardname.trim().length === 0 || boardname.length > 20 || /[^a-zA-Z0-9 ]/.test(boardname);

		if (boardname_invalid) return;

		busy = true;
		try {
			const res = await authFetch(`${kanbanapiurl}board/edit`, correlationID, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					board_id: boardId,
					name: boardname,
					is_public: visibility === "public"
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toast({
					title: $_("kanban.board.id.edit.error.update_failed"),
					desc: "Error: " + err,
					icon: "crisis_alert",
					appearance: "danger",
					position: "top-center",
					autoDismiss: 5000
				});
				busy = false;
				return;
			}

			const updated = await res.json();
			toast({
				title: $_("kanban.board.id.edit.toast.board_update_successfull.title"),
				desc: $_("kanban.board.id.edit.toast.board_update_successfull.desc", { values: { board_name: updated.name } }),
				icon: "celebration",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			goto(`/board/${updated.id}`);
		} catch (err) {
			console.warn("Error updating board:", err);
			toast({
				title: $_("kanban.board.id.edit.error.something_failed"),
				desc: "Error: " + err,
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
		} finally {
			busy = false;
		}
	}
</script>

<div class="background">
	<h2 style="text-align: center; margin: 0.5rem;">{$_("kanban.board.id.edit.title.edit_board")} <br /> {initialName}.</h2>
	<h4 style="text-align: center; margin: 0px; color: var(--token-color-text-default-secondary);">
		{$_("kanban.board.id.edit.title.current_settings")}
	</h4>
	<Space height="var(--token-space-4)" />
	<TextField
		label={$_("kanban.board.id.edit.field.board_name.label")}
		type="text"
		placeholder={$_("kanban.board.id.edit.field.board_name.placeholder")}
		bind:value={boardname}
		invalid={boardname_invalid}
		invalidMessage={$_("kanban.board.id.edit.field.board_name.invalid")}
	/>
	<Space height="var(--token-space-3)" />

	<FlexWrapper direction="column" alignitems="flex-start" width="100%">
		<span>{$_("kanban.board.id.edit.title.board_visibility")}</span>
		<Space height="var(--token-space-1)" />
		<Dropdown actions={visibilityOptions} bind:value={visibility} appearance="subtle" />
	</FlexWrapper>

	<Space height="var(--token-space-3)" />
	<FlexWrapper direction="row" justifycontent="flex-end" width="100%">
		<Button appearance="subtle" loading={busy} onClick={() => window.history.back()}>{$_("kanban.board.id.edit.btn.cancel")}</Button>
		<Button appearance="primary" onClick={editBoard} loading={busy} disabled={noChanges}>{$_("kanban.board.id.edit.btn.edit_board")}</Button>
	</FlexWrapper>
</div>

<style>
	.background {
		background-color: var(--token-color-surface-sunken-normal);
		padding: 4rem 5rem;
		padding-top: 0rem;
		border-radius: 1rem;
		width: 300px;
		height: 680px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: var(--token-space-2);
	}
</style>
