<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { kanbanapiurl } from "$lib/config";
	import { authFetch } from "$lib/session";
	import { Button, Dropdown, FlexWrapper, Space, TextField, toast } from "@davidnet/svelte-ui";
	import { onMount } from "svelte";

	let boardId = Number(page.params.id);
	let boardname: string = "";
	let visibility = "private";

	const correlationID = crypto.randomUUID();
	let boardname_invalid = false;
	let busy = false;
	let initialName = "";
	let initialVisibility = "";

	const visibilityOptions = [
		{ label: "Private", value: "private" },
		{ label: "Public", value: "public" }
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
				title: "Something exploded!",
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
					title: "Update failed",
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
				title: "Board updated.",
				desc: "Board " + updated.name + " updated successfully.",
				icon: "celebration",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			goto(`/board/${updated.id}`);
		} catch (err) {
			console.warn("Error updating board:", err);
			toast({
				title: "Something failed",
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
	<h2 style="text-align: center; margin: 0.5rem;">Edit board: <br> {initialName}.</h2>
    <h4 style="text-align: center; margin: 0px; color: var(--token-color-text-default-secondary);">These are your current settings.</h4>
	<Space height="var(--token-space-4)" />
	<TextField
		label="Name:"
		type="text"
		placeholder="Enter new board name"
		bind:value={boardname}
		invalid={boardname_invalid}
		invalidMessage="Name should be max 20 characters. And may not contain special characters."
	/>
	<Space height="var(--token-space-3)" />

	<FlexWrapper direction="column" alignitems="flex-start" width="100%">
		<span>Board visibility:</span>
		<Space height="var(--token-space-1)" />
		<Dropdown actions={visibilityOptions} bind:value={visibility} appearance="subtle" />
	</FlexWrapper>

	<Space height="var(--token-space-3)" />
	<FlexWrapper direction="row" justifycontent="flex-end" width="100%">
		<Button appearance="subtle" loading={busy} onClick={() => window.history.back()}>Cancel</Button>
		<Button appearance="primary" onClick={editBoard} loading={busy} disabled={noChanges}>Edit board</Button>
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
