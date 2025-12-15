<script lang="ts">
	import { authapiurl, kanbanapiurl } from "$lib/config";
	import type { ProfileResponse } from "$lib/types";
	import {
		Button,
		Dropdown,
		FlexWrapper,
		Icon,
		IconButton,
		Loader,
		Space,
		TextField,
		toast,
		Modal,
		accessToken,
		authFetch as sesauthfetch
	} from "@davidnet/svelte-ui";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import { _ } from "svelte-i18n";

	let { closeOverlay, boardOwner, correlationID, boardId } = $props<{
		closeOverlay: () => void;
		boardOwner: number;
		correlationID: string;
		boardId: number;
	}>();

	const token = String(get(accessToken));

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

	let loaded = $state(false);
	let owner: ProfileResponse | null = $state(null);
	let connections: Array<any> = $state([]);
	let members: Array<any> = $state([]);
	let pendingInvites: Array<any> = $state([]);

	let newidentfier: string | undefined = $state(undefined);
	let newidentfierconnection: string | undefined = $state(undefined);
	let viewinvites: boolean = $state(false);

	let showRemoveMemberModal = $state(false);
	let memberToRemove: any = $state(null);

	async function fetchProfile(id: number | undefined) {
		if (!id || isNaN(id)) {
			console.warn("fetchProfile received invalid id:", id);
			throw new Error("Invalid user ID");
		}

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

			if (!res.ok) throw new Error(`Profile fetch failed with status ${res.status}`);
			const data = await res.json();
			return data;
		} catch (err) {
			toast({
				title: $_("kanban.components.boardaccess.error.network"),
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
			throw err;
		}
	}

	async function loadMembers() {
		try {
			const result = await authFetch(`${kanbanapiurl}board/get_board_members`, { board_id: boardId });
			const enriched = await Promise.all(
				(result || []).map(async (member: any) => {
					const userId = typeof member === "number" ? member : member.user_id;
					try {
						const profile = await fetchProfile(userId);
						return {
							...(typeof member === "object" ? member : { user_id: userId }),
							display_name: profile?.profile.display_name ?? "Unknown",
							username: profile?.profile.username ?? "unknown",
							avatar_url: profile?.profile.avatar_url ?? "https://account.davidnet.net/placeholder.png"
						};
					} catch {
						return {
							...(typeof member === "object" ? member : { user_id: userId }),
							display_name: "Unknown",
							username: "unknown",
							avatar_url: "https://account.davidnet.net/placeholder.png"
						};
					}
				})
			);

			members = enriched;
		} catch (err) {
			toast({
				title: $_("kanban.components.boardaccess.error.failed_load_board_members"),
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
		}
	}

	async function loadInvites() {
		try {
			const invites = await authFetch(`${kanbanapiurl}invite/board`, { board_id: boardId });
			const enriched = await Promise.all(
				(invites || []).map(async (invite: any) => {
					const userId = typeof invite === "number" ? invite : invite.invitee_user_id;
					try {
						const profile = await fetchProfile(userId);
						return {
							...(typeof invite === "object" ? invite : { invitee_user_id: userId }),
							display_name: profile?.profile.display_name ?? "Unknown",
							username: profile?.profile.username ?? "unknown",
							avatar_url: profile?.profile.avatar_url ?? "https://account.davidnet.net/placeholder.png"
						};
					} catch {
						return {
							...(typeof invite === "object" ? invite : { invitee_user_id: userId }),
							display_name: "Unknown",
							username: "unknown",
							avatar_url: "https://account.davidnet.net/placeholder.png"
						};
					}
				})
			);
			pendingInvites = enriched;
		} catch (err) {
			toast({
				title: $_("kanban.components.boardaccess.error.failed_to_load_invites"),
				icon: "crisis_alert",
				appearance: "danger",
				position: "top-center",
				autoDismiss: 5000
			});
		}
	}

	onMount(async () => {
		owner = await fetchProfile(boardOwner);
		await loadMembers();
		await loadInvites();

		const connectionsres = await sesauthfetch(authapiurl + "connections/", correlationID);
		if (connectionsres.ok) {
			const connectionsreq = await connectionsres.json();
			connections = connectionsreq.connections || [];
		}
		loaded = true;
	});

	async function inviteuser(identifier: string | undefined | null) {
		if (!identifier) return;

		let userID: number;
		try {
			const requserID = await authFetch(`${authapiurl}resolve-identifier`, { identifier });
			userID = Number(requserID.id);
		} catch (err) {
			newidentfier = undefined;
			newidentfierconnection = undefined;
			toast({
				title: $_("kanban.components.boardaccess.error.user_not_found"),
				icon: "person_alert",
				appearance: "warning",
				position: "bottom-left",
				autoDismiss: 10000
			});
			return;
		}

		if (userID === owner?.profile.id) {
			toast({
				title: $_("kanban.components.boardaccess.error.user_already_in_board"),
				desc: identifier,
				icon: "person_alert",
				appearance: "info",
				position: "bottom-left",
				autoDismiss: 10000
			});
			return;
		}

		try {
			await authFetch(`${kanbanapiurl}invite/send`, { board_id: boardId, user_id: userID });
			toast({
				title: $_("kanban.components.boardaccess.toast.invite_send.title"),
				desc: identifier,
				icon: "person_add",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			newidentfier = undefined;
			newidentfierconnection = undefined;
			await loadInvites();
		} catch (err) {
			toast({
				title: $_("kanban.components.boardaccess.error.could_not_send_invite"),
				icon: "crisis_alert",
				appearance: "danger",
				position: "bottom-left",
				autoDismiss: 5000
			});
		}
	}

	async function cancelInvite(inviteId: number) {
		try {
			await authFetch(`${kanbanapiurl}invite/cancel`, { invite_id: inviteId });
			toast({
				title: $_("kanban.components.boardaccess.toast.invite_canceled.title"),
				icon: "person_cancel",
				appearance: "warning",
				position: "bottom-left",
				autoDismiss: 5000
			});
			await loadInvites();
		} catch (err) {
			toast({
				title: $_("kanban.components.boardaccess.error.cancel_invite_failed"),
				icon: "crisis_alert",
				appearance: "danger",
				position: "bottom-left",
				autoDismiss: 5000
			});
		}
	}

	function confirmRemoveMember(user_id: number, display_name: string) {
		memberToRemove = { user_id, display_name };
		showRemoveMemberModal = true;
	}

	async function removeMemberConfirmed() {
		if (!memberToRemove) return;

		try {
			await authFetch(`${kanbanapiurl}board/remove_member`, { board_id: boardId, member_id: memberToRemove.user_id });
			toast({
				title: $_("kanban.components.boardaccess.toast.member_removed.title"),
				desc: memberToRemove.display_name,
				icon: "person_remove",
				appearance: "warning",
				position: "bottom-left",
				autoDismiss: 5000
			});
			await loadMembers();
		} catch (err) {
			toast({
				title: $_("kanban.components.boardaccess.error.remove_failed"),
				desc: $_("kanban.components.boardaccess.error.remove_failed_desc"),
				icon: "crisis_alert",
				appearance: "danger",
				position: "bottom-left",
				autoDismiss: 5000
			});
		} finally {
			memberToRemove = null;
			showRemoveMemberModal = false;
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="blanket" onclick={(e) => e.target === e.currentTarget && closeOverlay()} tabindex="-1" aria-modal="true">
	<div class="content">
		{#if loaded}
			<header class="header">
				<h2>{$_("kanban.components.boardaccess.title")}</h2>
				<div>
					<IconButton icon="help" disabled onClick={() => {}} appearance="subtle" alt={$_("kanban.components.boardaccess.about_alt")} />
					<IconButton icon="close" appearance="primary" onClick={closeOverlay} alt={$_("kanban.components.boardaccess.close_alt")} />
				</div>
			</header>

			<div class="container">
				<div class="overlay-body">
					{#if viewinvites}
						<div class="members">
							<h4>{$_("kanban.components.boardaccess.section.invites")}</h4>
							{#if pendingInvites.length === 0}
								<p style="color: var(--token-color-text-default-secondary);">
									{$_("kanban.components.boardaccess.no_pending_invites")}
								</p>
							{:else}
								{#each pendingInvites as invite (invite.invite_id)}
									<div class="member">
										<FlexWrapper direction="row" gap="var(--token-space-3);">
											<img crossorigin="anonymous" src={invite.avatar_url} alt="profile" />
											<a href={`https://account.davidnet.net/profile/${invite.invitee_user_id}`}>
												{invite.display_name}
												<span class="secondary">@{invite.username}</span>
											</a>
										</FlexWrapper>
										<IconButton
											icon="person_cancel"
											appearance="warning"
											onClick={() => cancelInvite(invite.invite_id)}
											alt={$_("kanban.components.boardaccess.cancel_invite_alt")}
										/>
									</div>
								{/each}
							{/if}
						</div>
						<Space height="var(--token-space-4)" />
						<Button appearance="subtle" onClick={() => (viewinvites = false)}>{$_("kanban.components.boardaccess.view_members")}</Button>
					{:else}
						<div class="members">
							<h4>{$_("kanban.components.boardaccess.section.members")}</h4>
							<div class="member">
								<FlexWrapper direction="row" gap="var(--token-space-3);">
									<img crossorigin="anonymous" src={owner?.profile.avatar_url} alt="profile" />
									<a href={`https://account.davidnet.net/profile/${boardOwner}`}>
										{owner?.profile.display_name}
										<span class="secondary">@{owner?.profile.username}</span>
									</a>
								</FlexWrapper>
								<Icon icon="crown" color="var(--token-color-text-warning);" size="1.5rem" />
							</div>

							{#each members as member (member.user_id)}
								<div class="member">
									<FlexWrapper direction="row" gap="var(--token-space-3);">
										<img crossorigin="anonymous" src={member.avatar_url} alt="profile" />
										<a href={`https://account.davidnet.net/profile/${member.user_id}`}>
											{member.display_name || "Unknown"}
											<span class="secondary">@{member.username || "unknown"}</span>
										</a>
									</FlexWrapper>
									<IconButton
										icon="person_remove"
										appearance="danger"
										alt={$_("kanban.components.boardaccess.remove_member_alt")}
										onClick={() => confirmRemoveMember(member.user_id, member.display_name)}
									/>
								</div>
							{/each}
						</div>
						<Space height="var(--token-space-4)" />
						<Button appearance="subtle" onClick={() => (viewinvites = true)}>{$_("kanban.components.boardaccess.view_invites")}</Button>
					{/if}
				</div>

				<div class="invite-container">
					<h3 style="margin-bottom: 0px;">{$_("kanban.components.boardaccess.invite.title")}</h3>
					<FlexWrapper width="100%" height="100%">
						<div class="invite">
							<FlexWrapper width="100%" direction="row" justifycontent="flex-start">
								<Dropdown
									actions={connections.map((user) => ({
										label: `${user.display_name} (@${user.username})`,
										value: user.username
									}))}
									bind:value={newidentfierconnection}
									appearance="subtle"
								>
									{$_("kanban.components.boardaccess.invite.quick_connections")}
								</Dropdown>
							</FlexWrapper>
							<Space height="var(--token-space-2);" />
							<FlexWrapper width="100%" direction="row" justifycontent="flex-end">
								<Button appearance="primary" disabled={!newidentfierconnection} onClick={() => inviteuser(newidentfierconnection)}>
									{$_("kanban.components.boardaccess.invite.button")}
								</Button>
							</FlexWrapper>
						</div>
						<Space height="var(--token-space-5);" />
						<div class="invite">
							<TextField
								label={$_("kanban.components.boardaccess.invite.enter_user_label")}
								type="text"
								placeholder={$_("kanban.components.boardaccess.invite.placeholder")}
								bind:value={newidentfier}
							/>
							<Space height="var(--token-space-2);" />
							<FlexWrapper width="100%" direction="row" justifycontent="flex-end">
								<Button appearance="primary" disabled={!newidentfier} onClick={() => inviteuser(newidentfier)}>
									{$_("kanban.components.boardaccess.invite.button")}
								</Button>
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

		{#if showRemoveMemberModal && memberToRemove}
			<Modal
				title={$_("kanban.components.boardaccess.modal.remove_title")}
				titleIcon="person_remove"
				desc={$_("kanban.components.boardaccess.modal.remove_desc", { values: { name: memberToRemove.display_name } })}
				hasCloseBtn
				on:close={() => {
					showRemoveMemberModal = false;
					memberToRemove = null;
				}}
				options={[
					{
						appearance: "subtle",
						content: $_("kanban.components.boardaccess.modal.cancel"),
						onClick: () => {
							showRemoveMemberModal = false;
							memberToRemove = null;
						}
					},
					{
						appearance: "danger",
						content: $_("kanban.components.boardaccess.modal.remove"),
						onClick: removeMemberConfirmed
					}
				]}
			/>
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
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		color: var(--token-color-text-default-normal);
		width: 85%;
		gap: var(--token-space-1);
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
