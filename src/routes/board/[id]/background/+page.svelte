<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { kanbanapiurl } from "$lib/config";
	import type { SessionInfo } from "$lib/types";
	import { authFetch, Button, FlexWrapper, getSessionInfo, Icon, refreshAccessToken, Space, toast } from "@davidnet/svelte-ui";
	import { onMount } from "svelte";
	import { _ } from "svelte-i18n";

	type Image = {
		link: string;
		author: {
			name: string;
			link: string;
		};
	};

	const images: Image[] = [
		{
			link: "https://cdn.pixabay.com/photo/2024/01/11/17/07/leaves-8502212_960_720.jpg",
			author: { link: "https://pixabay.com/users/heikiwi-35444888/", name: "HeiKiwi" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2025/10/23/05/43/bird-9910830_960_720.jpg",
			author: { link: "https://pixabay.com/users/bitnikgao-38671825/", name: "bitnikgao" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2025/09/19/05/48/mountain-range-9842371_1280.jpg",
			author: { link: "https://pixabay.com/users/ahmetyuksek-45995253/", name: "ahmetyuksek" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2022/11/05/19/56/bachalpsee-7572681_1280.jpg",
			author: { link: "https://pixabay.com/users/himmelstraeume-28503001/", name: "Himmelstraeume" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2022/10/24/17/50/mountains-7544027_1280.jpg",
			author: { link: "https://pixabay.com/users/parsleyball-17749603/", name: "ParsleyBall" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2018/02/06/22/43/painting-3135875_1280.jpg",
			author: { link: "https://pixabay.com//users/mondschwinge-1453918/", name: "Mondschwinge" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2022/09/21/17/02/blue-background-7470781_1280.jpg",
			author: { link: "https://pixabay.com/nl/users/molnarszabolcserdely-2742379/", name: "MolnarSzabolcsErdely" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2025/09/07/10/32/mountain-layers-9820349_960_720.jpg",
			author: { link: "https://pixabay.com/users/ahmetyuksek-45995253/", name: "ahmetyuksek" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2023/05/01/18/06/windmill-7963566_1280.jpg",
			author: { link: "https://pixabay.com/users/manfredrichter-4055600/", name: "manfredrichter" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2020/10/05/10/51/cat-5628953_1280.jpg",
			author: { link: "https://pixabay.com/users/nennieinszweidrei-10084616/", name: "Nennieinszweidrei" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2015/11/16/14/43/cat-1045782_1280.jpg",
			author: { link: "https://pixabay.com/nl/users/cocoparisienne-127419/", name: "cocoparisienne" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2025/11/04/15/22/amsterdam-9936659_1280.jpg",
			author: { link: "https://pixabay.com/nl/users/rianne_schillermclean-16944533/", name: "Rianne_SchillerMclean" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2020/02/09/17/29/amsterdam-4833927_960_720.jpg",
			author: { link: "https://pixabay.com/nl/users/lena1-326348/", name: "lena1" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2025/02/07/16/55/flower-9390610_1280.jpg",
			author: { link: "https://pixabay.com/users/heikiwi-35444888/", name: "HeiKiwi" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2024/11/21/14/43/dahlia-9214046_960_720.jpg",
			author: { link: "https://pixabay.com/users/heikiwi-35444888/", name: "HeiKiwi" }
		},
		{
			link: "https://cdn.pixabay.com/photo/2018/01/14/23/12/nature-3082832_960_720.jpg",
			author: { link: "https://pixabay.com/users/jplenio-7645255/", name: "jplenio" }
		}
	];

	const board_id = page.params.id;
	const correlationID = crypto.randomUUID();
	let si: SessionInfo | null = $state(null);
	let selected_image: Image | null = $state(null);

	onMount(async () => {
		await refreshAccessToken(correlationID, true, false);
		si = await getSessionInfo(correlationID, true);
	});

	async function setbackground() {
		if (!selected_image) return;

		try {
			const res = await authFetch(`${kanbanapiurl}board/set-background`, correlationID, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					board_id: Number(board_id),
					background_url: selected_image.link
				})
			});

			if (!res.ok) {
				const err = await res.json();
				console.error("Failed to update background:", err);
				return;
			}

			toast({
				title: $_("kanban.board.id.background.toast.saved"),
				icon: "celebration",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			goto("/board/" + board_id);
		} catch (err) {
			toast({
				title: $_("kanban.board.id.background.toast.save_error"),
				icon: "crisis_alert",
				appearance: "danger",
				position: "bottom-left",
				autoDismiss: 5000
			});
			console.error(err);
		}
	}
</script>

<h1>{$_("kanban.board.id.background.title")}</h1>
<Space height="var(--token-space-3)" />

<div class="boards-grid">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{#each images as image}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="board-card {selected_image === image ? 'selected' : ''}" onclick={() => (selected_image = image)}>
			<img src={image.link} alt="Board background" aria-hidden="true" />
			<div class="overlay">
				<a href={image.author.link} target="_blank" rel="noopener noreferrer">
					{image.author.name}
				</a>
			</div>
		</div>
	{/each}
	<div class="board-card">
		<div class="tijdelijk">
			<FlexWrapper height="100%" width="100%">
				<Icon icon="add" size="120px"/>
			</FlexWrapper>
		</div>
		<div class="overlay">
			Upload your own picture
		</div>
	</div>
</div>

<FlexWrapper direction="row" gap="var(--token-space-1)">
	<Button appearance="primary" onClick={setbackground} disabled={!selected_image}>{$_("kanban.board.id.background.btn.set_background")}</Button>
	<Button iconbefore="arrow_back" onClick={() => history.back()}>{$_("kanban.board.id.background.btn.back")}</Button>
</FlexWrapper>

<Space height="var(--token-space-6)/>

<style>
	.boards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--token-space-3);
		margin: var(--token-space-2) auto;
		width: 100%;
		max-width: 1000px;
		overflow-y: scroll;
	}

	.board-card {
		position: relative;
		border-radius: 1rem;
		overflow: hidden;
		cursor: pointer;
		background: var(--token-color-surface-raised-normal);
		transition:
			transform 0.3s ease,
			box-shadow 0.3s ease,
			border 0.2s ease;
		border: 3px solid transparent;
	}

	.board-card.selected {
		border-color: var(--token-color-focusring);
	}

	.board-card:hover {
		transform: translateY(-4px);
		background: var(--token-color-surface-raised-hover);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
	}

	.board-card img {
		width: 100%;
		height: 140px;
		object-fit: cover;
		display: block;
	}

	.tijdelijk {
		width: 100%;
		height: 140px;
		object-fit: cover;
		display: block;
	}

	.overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
		text-align: center;
		padding: 0.5rem;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.board-card:hover .overlay {
		opacity: 1;
	}

	.overlay a {
		color: #fff;
		text-decoration: underline;
	}
</style>
