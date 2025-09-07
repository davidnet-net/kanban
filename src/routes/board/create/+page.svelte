<script lang="ts">
	import { goto } from "$app/navigation";
	import { kanbanapiurl } from "$lib/config";
	import { authFetch } from "$lib/session";
	import { Button, Dropdown, FlexWrapper, Space, TextField, toast } from "@davidnet/svelte-ui";
	let boardname: string = "";
	let visibility = "private";

	const correlationID = crypto.randomUUID();
	let boardname_invalid = false;

	const visibilityOptions = [
		{ label: "Private", value: "private" },
		{ label: "Public", value: "public" }
	];

	let busy = false;

	async function createboard() {
        boardname_invalid = !boardname || boardname.trim().length === 0 || boardname.length > 20 || /[^a-zA-Z0-9 ]/.test(boardname);
		busy = true;

        if (boardname_invalid) {
			busy = false;
            return;
        }
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
					background_url: "https://trello-backgrounds.s3.amazonaws.com/SharedBackground/480x320/90a5611273ca04096a9b9145d68847c0/photo-1742845918430-c6093f93f740.webp" //TODO
				})
			});

			if (!res.ok) {
				const err = await res.json();
				console.warn("Failed to create board:", err);
				toast({
					title: "Something failed",
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
				title: "Board created.",
				desc: "Board " + board.name + " created.",
				icon: "celebration",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			goto(`/board/${board.id}`);
		} catch (err) {
			console.warn("Error creating board:", err);
			toast({
				title: "Something failed",
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
	<h2>Create an new board</h2>
	<Space height="var(--token-space-4)" />
	<TextField
		label="Name of the new board."
		type="text"
		placeholder="Enter new board name"
        bind:value={boardname}
		invalid={boardname_invalid}
		invalidMessage="Name should be max 20 characters. And may not contain special characters."
	/>
	<Space height="var(--token-space-3)" />

	<FlexWrapper direction="column" alignitems="flex-start" width="100%">
		<span>Bord visibility</span>
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
			}}>Cancel</Button
		>
		<Button appearance="primary" onClick={createboard} loading={busy}>Create new board.</Button>
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
