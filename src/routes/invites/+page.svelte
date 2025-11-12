<script lang="ts">
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import { authapiurl, kanbanapiurl } from "$lib/config";
	import { FlexWrapper, Button, Loader, toast, Space, accessToken, refreshAccessToken, authFetch as sesauthfetch } from "@davidnet/svelte-ui";
	import type { ProfileResponse, UserProfile } from "$lib/types";

	import {_} from 'svelte-i18n';
	
	interface Invite {
		invite_id: number;
		board_id: number;
		board_name: string;
		inviter_id: number;
		// will enrich these manually
		inviter?: UserProfile;
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

	async function fetchProfile(id: number): Promise<UserProfile | null> {
		try {
			const res = await fetch(`${authapiurl}profile/${id}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`
				},
				credentials: "include"
			});

			if (!res.ok) {
				toast({
					title: $_('kanban.invites.error.profiles_failed_to_load.title'),
					desc: $_('kanban.invites.error.profiles_failed_to_load.desc'),
					icon: "crisis_alert",
					appearance: "danger",
					position: "top-center",
					autoDismiss: 5000
				});
				return null;
			}

			const data: ProfileResponse = await res.json();
			return data.profile;
		} catch (err) {
			console.error("fetchProfile error:", err);
			toast({
				title: $_('kanban.invites.error.network_error.title'),
				desc: $_('kanban.invites.error.network_error.desc'),
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
			return null;
		}
	}

	async function loadInvites() {
		try {
			const result: Invite[] = await authFetch(`${kanbanapiurl}invite/my`, {}, "GET");
			// fetch profiles in parallel
			const enriched = await Promise.all(
				result.map(async (invite) => {
					const profile = await fetchProfile(invite.inviter_id);
					return { ...invite, inviter: profile ?? undefined };
				})
			);
			invites = enriched;
		} catch (err) {
			console.error("Failed to load invites:", err);
			toast({
				title: $_('kanban.invites.error.failed_to_load_invites.title'),
				desc: $_('kanban.invites.error.failed_to_load_invites.desc'),
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
				title: $_('kanban.invites.toast.invite_accepted.title'),
				desc: $_('kanban.invites.toast.invite_accepted.desc'),
				icon: "person_add",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			await loadInvites();
		} catch (err) {
			console.error("Accept invite failed:", err);
			toast({
				title: $_('kanban.invites.error.failed_to_accept_invite.title'),
				desc: $_('kanban.invites.error.failed_to_accept_invite.desc'),
				icon: "crisis_alert",
				appearance: "danger",
				position: "bottom-left",
				autoDismiss: 5000
			});
		}
	}

	async function denyInvite(inviteId: number) {
		try {
			await authFetch(`${kanbanapiurl}invite/decline`, { invite_id: inviteId });
			toast({
				title: $_('kanban.invites.toast.invite_declined.title'),
				desc: $_('kanban.invites.toast.invite_declined.desc'),
				icon: "person_cancel",
				appearance: "warning",
				position: "bottom-left",
				autoDismiss: 5000
			});
			await loadInvites();
		} catch (err) {
			console.error("Deny invite failed:", err);
			toast({
				title: $_('kanban.invites.error.invite_declined_failed.title'),
				desc: $_('kanban.invites.error.invite_declined_failed.desc'),
				icon: "crisis_alert",
				appearance: "danger",
				position: "bottom-left",
				autoDismiss: 5000
			});
		}
	}

	onMount(async () => {
		await refreshAccessToken(crypto.randomUUID(), false, true);
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
		<Button
			appearance="subtle"
			onClick={() => {
				history.back();
			}}
			iconbefore="arrow_back">{$_('kanban.invites.btn.back')}</Button
		>
		<h2>{$_('kanban.invites.title.my_board_invites')}</h2>

		{#if invites.length === 0}
			<p style="color: var(--token-color-text-default-secondary);">{$_('kanban.invites.title.you_have_no_pending_board_invites')}</p>
		{:else}
			<div class="invite-list">
				{#each invites as invite (invite.invite_id)}
					<div class="invite-item">
						<div class="invite-info">
							<strong>{invite.board_name}</strong>
							<Space width="var(--token-space-4);" />
							{#if invite.inviter}
								{$_('kanban.invites.title.invited_by')}
								<Space width="var(--token-space-4);" />
								<FlexWrapper direction="row" gap="var(--token-space-3);">
									<img crossorigin="anonymous" class="pp" src={invite.inviter.avatar_url || "https://account.davidnet.net/placeholder.png"} alt="profile" />
									<a href={`https://account.davidnet.net/profile/${invite.inviter.id}`}>
										{invite.inviter.display_name}
										<span class="secondary">@{invite.inviter.username}</span>
									</a>
								</FlexWrapper>
							{/if}
						</div>
						<Space width="var(--token-space-3);" />
						<FlexWrapper direction="row" gap="var(--token-space-2)">
							<Button appearance="primary" onClick={() => acceptInvite(invite.invite_id)}>{$_('kanban.invites.btn.accept')}</Button>
							<Button appearance="danger" onClick={() => denyInvite(invite.invite_id)}>{$_('kanban.invites.btn.deny')}</Button>
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

	.invite-info {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
		gap: var(--token-space-3);
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
		color: var(--token-color-text-default-tertiary);
	}

	.secondary {
		color: var(--token-color-text-default-secondary);
	}

	.pp {
		border-radius: 50%;
		height: 1.5rem;
		width: 1.5rem;
	}
</style>
