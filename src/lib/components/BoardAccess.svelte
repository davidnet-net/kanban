<script lang="ts">
	import { authapiurl } from "$lib/config";
	import { accessToken } from "$lib/session";
	import type { ProfileResponse } from "$lib/types";
	import { formatDate_PREFERREDTIME } from "$lib/utils/time";
	import { Button, Dropdown, FlexWrapper, Icon, IconButton, Loader, Space, TextField, toast } from "@davidnet/svelte-ui";
	import { onMount } from "svelte";
	import { get } from "svelte/store";

	let { closeOverlay, boardOwner, correlationID } = $props<{
		closeOverlay: () => void;
		boardOwner: number;
		correlationID: string;
	}>();

	let loaded = $state(true);
	let owner: ProfileResponse | null = $state(null);
	onMount(async () => {
		owner = await fetchProfile(boardOwner);
	});

	async function fetchProfile(id: number) {
		let created_on: string;
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
					title: "Profile load error",
					desc: "Some profile(s) could not be loaded.",
					icon: "crisis_alert",
					appearance: "danger",
					position: "top-center",
					autoDismiss: 5000
				});
			}

			const data = await res.json();
			console.log(data);
			created_on = await formatDate_PREFERREDTIME(data.profile.created_at, correlationID);
			return data;
		} catch (err) {
			console.error("fetchProfile error:", err);
			toast({
				title: "Network Error",
				desc: "Something went wrong while fetching the profile.",
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
		}
	}

	let newidentfier: string | undefined = $state(undefined);
	let newidentfierconnection: string | undefined = $state(undefined);
	let viewinvites: boolean = $state(false);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="blanket" onclick={(e) => e.target === e.currentTarget && closeOverlay()} tabindex="-1" aria-modal="true">
	<div class="content">
		{#if loaded}
			<header class="header">
				<h2>Board Access</h2>
				<div>
					<IconButton icon="help" disabled appearance="subtle" onClick={() => {}} alt="About board access." />
					<IconButton icon="close" appearance="primary" onClick={closeOverlay} alt="Close." />
				</div>
			</header>

			<div class="container">
				<div class="overlay-body">
					{#if viewinvites}
						<div class="members">
							<h4>Invitations</h4>

							<div class="member">
								<img src="https://account.davidnet.net/placeholder.png" alt="test" />
								<a href="https://account.davidnet.net/profile/[placeholder]"
									>PLACEHOLDER <span class="secondary">@placeholder</span></a
								>
								<IconButton icon="person_cancel" appearance="warning" onClick={() => {}} alt="Cancel invite" />
							</div>
							<div class="member">
								<img src="https://account.davidnet.net/placeholder.png" alt="test" />
								<a href="https://account.davidnet.net/profile/[placeholder]"
									>PLACEHOLDER <span class="secondary">@placeholder</span></a
								>
								<IconButton icon="person_cancel" appearance="warning" onClick={() => {}} alt="Cancel invite" />
							</div>
							<div class="member">
								<img src="https://account.davidnet.net/placeholder.png" alt="test" />
								<a href="https://account.davidnet.net/profile/[placeholder]"
									>PLACEHOLDER <span class="secondary">@placeholder</span></a
								>
								<IconButton icon="person_cancel" appearance="warning" onClick={() => {}} alt="Cancel invite" />
							</div>
						</div>
						<Space height="var(--token-space-4)" />
						<Button
							appearance="subtle"
							onClick={() => {
								viewinvites = false;
							}}>View members</Button
						>
					{:else}
						<div class="members">
							<h4>Members</h4>
							<div class="member">
								<FlexWrapper direction="row" gap="var(--token-space-3);">
									<img src={owner?.profile.avatar_url} aria-hidden="true" alt="" />
									<a href="https://account.davidnet.net/profile/{boardOwner}"
										>{owner?.profile.display_name} <span class="secondary">@{owner?.profile.username}</span></a
									>
								</FlexWrapper>

								<FlexWrapper direction="row">
									<Icon icon="crown" color="var(--token-color-text-warning);" size="1.5rem" />
									<Space width="var(--token-space-3);" />
								</FlexWrapper>
							</div>
							<div class="member">
								<FlexWrapper direction="row" gap="var(--token-space-3);">
									<img src="https://account.davidnet.net/placeholder.png" alt="test" />
									<a href="https://account.davidnet.net/profile/[placeholder]"
										>PLACEHOLDER <span class="secondary">@placeholder</span></a
									>
								</FlexWrapper>

								<IconButton icon="person_remove" appearance="danger" onClick={() => {}} alt="Unshare" />
							</div>
							<div class="member">
								<FlexWrapper direction="row" gap="var(--token-space-3);">
									<img src="https://account.davidnet.net/placeholder.png" alt="test" />
									<a href="https://account.davidnet.net/profile/[placeholder]"
										>PLACEHOLDER <span class="secondary">@placeholder</span></a
									>
								</FlexWrapper>

								<IconButton icon="person_remove" appearance="danger" onClick={() => {}} alt="Unshare" />
							</div>
							<div class="member">
								<FlexWrapper direction="row" gap="var(--token-space-3);">
									<img src="https://account.davidnet.net/placeholder.png" alt="test" />
									<a href="https://account.davidnet.net/profile/[placeholder]"
										>PLACEHOLDER <span class="secondary">@placeholder</span></a
									>
								</FlexWrapper>

								<IconButton icon="person_remove" appearance="danger" onClick={() => {}} alt="Unshare" />
							</div>
						</div>
						<Space height="var(--token-space-4)" />
						<Button
							appearance="subtle"
							onClick={() => {
								viewinvites = true;
							}}>View invites</Button
						>
					{/if}
				</div>
				<div class="invite-container">
					<h3 style="margin-bottom: 0px;">Invite new people</h3>
					<FlexWrapper width="100%" height="100%">
						<div class="invite">
							<FlexWrapper width="100%" direction="row" justifycontent="flex-start">
								<Dropdown
									actions={[
										{ label: "Cone A", value: "A" },
										{ label: "Cone B", value: "B" },
										{ label: "Cone C", value: "C" }
									]}
									bind:value={newidentfierconnection}
									appearance="subtle"
								>
									Quick connections invite
								</Dropdown>
							</FlexWrapper>
							<Space height="var(--token-space-2);" />
							<FlexWrapper width="100%" direction="row" justifycontent="flex-end">
								<Button appearance="primary" onClick={() => {}}>Invite</Button>
							</FlexWrapper>
						</div>
						<Space height="var(--token-space-5);" />
						<div class="invite">
							<TextField
								label="Enter the user you want to invite:"
								type="text"
								placeholder="Email or username"
								bind:value={newidentfier}
								invalid={false}
								invalidMessage="Unknown user."
							/>
							<Space height="var(--token-space-2);" />
							<FlexWrapper width="100%" direction="row" justifycontent="flex-end">
								<Button appearance="primary" onClick={() => {}}>Invite</Button>
							</FlexWrapper>
						</div>
					</FlexWrapper>
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
		overflow-y: hidden;
		padding: 1.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
	}

	.overlay-body {
		width: 50%;
		gap: 1rem;
		min-height: 400px;
	}

	.invite-container {
		text-align: center;
		background-color: var(--token-color-surface-raised-normal);
		width: 50%;
		padding: 1rem;
		padding-top: 0rem;
	}

	.invite {
		text-align: center;
		background-color: var(--token-color-surface-overlay-normal);
		width: 80%;
		padding: 2rem;
		border-radius: 1rem;
	}

	.members {
		gap: var(--token-space-3);
		display: flex;
		flex-direction: column;
		overflow-x: scroll;
	}

	.member {
		background-color: var(--token-color-surface-overlay-hover);
		padding: 1rem;
		border-radius: 1rem;
		vertical-align: middle;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		color: var(--token-color-text-default-normal);
		width: 85%;
		gap: var(--token-space-1);
		line-height: 1.2;
		text-align: left;
	}

	.member a {
		color: var(--token-color-text-default-normal);
		text-decoration: none;
	}

	.member a:hover {
		color: var(--token-color-text-default-secondary);
	}

	.member img {
		border-radius: 50%;
		height: 1.5rem;
		width: 1.5rem;
	}

	.member:hover {
		background-color: var(--token-color-surface-overlay-pressed);
		transform: scale(1.01);
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

	.members {
		margin-top: 1rem;
		padding-bottom: 1rem;
	}

	.members h4 {
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--token-color-text-default-secondary);
	}
</style>
