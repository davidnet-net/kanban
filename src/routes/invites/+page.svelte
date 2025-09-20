<script lang="ts">
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import { authapiurl, kanbanapiurl } from "$lib/config";
	import { accessToken, refreshAccessToken, authFetch as sesauthfetch } from "$lib/session";
	import { FlexWrapper, Button, Loader, toast } from "@davidnet/svelte-ui";

	interface Invite {
		invite_id: number;
		board_id: number;
		board_name: string;
		inviter_user_id: number;
		inviter_display_name: string;
		inviter_username: string;
	}

	let invites: Invite[] = [];
	let loaded = false;
    let token: string;

	async function authFetch(url: string, body: any, method: "POST" | "GET" = "POST") {
		let res;
        if (method === "POST") {
			res = await fetch(url, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				body: JSON.stringify(body)
			});
		} else {
			res = await fetch(url, {
				method: "GET",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {})
				}
			});
		}

		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json();
	}

	async function loadInvites() {
		try {
			const result = await authFetch(`${kanbanapiurl}invite/my`, {}, "GET");
			invites = result || [];
		} catch (err) {
			console.error("Failed to load invites:", err);
			toast({
				title: "Failed to load invites",
				desc: "Could not fetch your invites.",
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
		} finally {
			loaded = true;
		}
	}

	async function acceptInvite(inviteId: number) {
		try {
			await authFetch(`${kanbanapiurl}invite/accept`, { invite_id: inviteId });
			toast({
				title: "Invite accepted",
				desc: "You are now part of the board!",
				icon: "person_add",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			await loadInvites();
		} catch (err) {
			console.error("Accept invite failed:", err);
			toast({
				title: "Failed to accept invite",
				desc: "Could not join board.",
				icon: "crisis_alert",
				appearance: "danger",
				position: "bottom-left",
				autoDismiss: 5000
			});
		}
	}

	async function denyInvite(inviteId: number) {
		try {
			await authFetch(`${kanbanapiurl}invite/deny`, { invite_id: inviteId });
			toast({
				title: "Invite denied",
				desc: "You have declined the invitation.",
				icon: "person_cancel",
				appearance: "warning",
				position: "bottom-left",
				autoDismiss: 5000
			});
			await loadInvites();
		} catch (err) {
			console.error("Deny invite failed:", err);
			toast({
				title: "Failed to deny invite",
				desc: "Could not deny invitation.",
				icon: "crisis_alert",
				appearance: "danger",
				position: "bottom-left",
				autoDismiss: 5000
			});
		}
	}

	onMount(async () => {
        await refreshAccessToken("", false, true);
	    token = String(get(accessToken));
		await loadInvites();
	});
</script>

{#if !loaded}
	<FlexWrapper width="100%" height="100%" justifycontent="center" alignitems="center">
		<Loader />
	</FlexWrapper>
{:else}
	<div class="invite-page">
		<h2>My Board Invitations</h2>

		{#if invites.length === 0}
			<p style="color: var(--token-color-text-default-secondary);">You have no pending invites.</p>
		{:else}
			<div class="invite-list">
				{#each invites as invite (invite.invite_id)}
					<div class="invite-item">
						<div class="invite-info">
							<strong>{invite.board_name}</strong> invited by
							<a href={`https://account.davidnet.net/profile/${invite.inviter_user_id}`}>
								{invite.inviter_display_name} (@{invite.inviter_username})
							</a>
						</div>
						<FlexWrapper direction="row" gap="var(--token-space-2)">
							<Button appearance="primary" onClick={() => acceptInvite(invite.invite_id)}>Accept</Button>
							<Button appearance="danger" onClick={() => denyInvite(invite.invite_id)}>Deny</Button>
						</FlexWrapper>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.invite-page {
		max-width: 800px;
		margin: 2rem auto;
		padding: 1rem;
		background-color: var(--token-color-surface-overlay-normal);
		border-radius: 12px;
	}
	.invite-page h2 {
		margin-bottom: 1rem;
	}
	.invite-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.invite-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background-color: var(--token-color-surface-raised-normal);
		border-radius: 1rem;
	}
	.invite-info a {
		color: var(--token-color-text-default-normal);
		text-decoration: none;
		margin-left: 0.25rem;
	}
	.invite-info a:hover {
		color: var(--token-color-text-default-secondary);
	}
</style>
