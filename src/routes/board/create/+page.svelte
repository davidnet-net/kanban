<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { kanbanapiurl } from "$lib/config";
	import { Button, Dropdown, FlexWrapper, Space, TextField, toast, authFetch } from "@davidnet/svelte-ui";
	let boardname: string = "";
	let visibility = "private";

	const correlationID = crypto.randomUUID();
	let boardname_invalid = false;
	import { _ } from "svelte-i18n";

	const visibilityOptions = [
		{ label: $_("kanban.create.option.private"), value: "private" },
		{ label: $_("kanban.create.option.public"), value: "public" }
	];

	let busy = false;

	async function createboard() {
		boardname_invalid = !boardname || boardname.trim().length === 0 || boardname.length > 20 || /[^a-zA-Z0-9 ]/.test(boardname);
		busy = true;

		if (boardname_invalid) {
			busy = false;
			return;
		}
		visibility;
		boardname_invalid = false;

		try {
			const res = await authFetch(`${kanbanapiurl}board/create`, correlationID, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					name: boardname,
					is_public: visibility === "public",
					background_url: "https://cdn.pixabay.com/photo/2025/09/07/10/32/mountain-layers-9820349_960_720.jpg" //TODO
				})
			});

			if (!res.ok) {
				const err = await res.json();
				console.warn("Failed to create board:", err);
				toast({
					title: $_("kanban.create.error.something_failed.title"),
					desc: "Error: " + err,
					icon: "crisis_alert",
					appearance: "danger",
					position: "top-center",
					autoDismiss: 5000
				});
				return;
			}

			const board = await res.json();
			busy = false;
			toast({
				title: $_("kanban.create.toast.board_created.title"),
				desc: $_("kanban.create.toast.board_created.desc", { values: { board_name: boardname } }),
				icon: "celebration",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			goto(`/board/${board.id}/background`);
		} catch (err) {
			console.warn("Error creating board:", err);
			toast({
				title: $_("kanban.create.error.something_failed.title"),
				desc: "Error: " + err,
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
		}
	}
</script>

<div class="background">
	<h2>{$_("kanban.create.title.create_an_new_board")}</h2>
	<Space height="var(--token-space-4)" />
	<TextField
		label={$_("kanban.create.field.name_of_the_new_board.label")}
		type="text"
		placeholder={$_("kanban.create.field.name_of_the_new_board.placeholder")}
		bind:value={boardname}
		invalid={boardname_invalid}
		invalidMessage={$_("kanban.create.field.name_of_the_new_board.rules")}
	/>
	<Space height="var(--token-space-3)" />

	<FlexWrapper direction="column" alignitems="flex-start" width="100%">
		<span>{$_("kanban.create.title.board_visibility")}</span>
		<Space height="var(--token-space-1)" />
		<Dropdown actions={visibilityOptions} bind:value={visibility} appearance="subtle" />
	</FlexWrapper>
	<Space height="var(--token-space-3)" />
	<FlexWrapper direction="row" justifycontent="flex-end" width="100%">
		<Button
			appearance="subtle"
			loading={busy}
			onClick={() => {
				window.history.back();
			}}>{$_("kanban.create.btn.cancel")}</Button
		>
		<Button appearance="primary" onClick={createboard} loading={busy}>{$_("kanban.create.btn.create_new_board")}</Button>
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
