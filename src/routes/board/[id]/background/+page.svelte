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

    import images from "$lib/backgrounds.json";

    const board_id = page.params.id;
    const correlationID = crypto.randomUUID();
    let si: SessionInfo | null = $state(null);
    let selected_image: Image | null = $state(null);
    let isUploadSelected = $state(false);

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

<div class="container">
    <h1>{$_("kanban.board.id.background.title")}</h1>
    <Space height="var(--token-space-3)" />

    <div class="scroll-wrapper">
        <div class="boards-grid">
            {#each images as image}
                <div 
                    class="board-card {selected_image === image ? 'selected' : ''}" 
                    role="button"
                    tabindex="0"
                    onclick={() => { selected_image = image; isUploadSelected = false; }}
                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selected_image = image; isUploadSelected = false; } }}
                >
                    <img src={image.link} alt="Board background" />
                    <div class="overlay">
                        <span class="author-text">
                            Photo by 
                            <a href={image.author.link} target="_blank" rel="noopener noreferrer" onclick={(e) => e.stopPropagation()}>
                                {image.author.name}
                            </a>
                        </span>
                    </div>
                </div>
            {/each}

            <div 
                class="board-card upload-card {isUploadSelected ? 'selected' : ''}"
                role="button"
                tabindex="0"
                onclick={() => {
                    isUploadSelected = true;
                    selected_image = null; 
                }}
                 onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { isUploadSelected = true; selected_image = null; } }}
            >
                <div class="placeholder-image">
                    <Icon icon="add_photo_alternate" size="48px" />
                </div>
                <div class="overlay static">
                    Upload your own picture
                </div>
            </div>
        </div>
    </div>

    <Space height="var(--token-space-4)" />

    <FlexWrapper direction="row" gap="var(--token-space-1)">
        <Button appearance="primary" onClick={setbackground} disabled={!selected_image}>{$_("kanban.board.id.background.btn.set_background")}</Button>
        <Button iconbefore="arrow_back" onClick={() => history.back()}>{$_("kanban.board.id.background.btn.back")}</Button>
    </FlexWrapper>

    <Space height="var(--token-space-6)" />
</div>

<style>
    .container {
        height: 100vh;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 var(--token-space-3);
        width: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden; 
    }

    /* NEW: This wrapper handles the size of the available space
       and the scrolling functionality. 
    */
    .scroll-wrapper {
        flex: 1;             /* Take all remaining vertical space */
        overflow-y: auto;    /* Enable scrollbar here */
        min-height: 0;       /* Prevent flex overflow issues */
        width: 100%;
        padding: 4px;        /* Padding for focus outlines */
    }

    .boards-grid {
        display: grid;
        /* Grid can now grow as tall as it needs to be inside the scroll-wrapper */
        height: auto; 
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--token-space-3);
        width: 100%;
        /* Ensure rows have a minimum size based on content */
        grid-auto-rows: min-content; 
    }

    .board-card {
        position: relative;
        border-radius: 1rem;
        overflow: hidden;
        cursor: pointer;
        background: var(--token-color-surface-raised-normal);
        /* Forces the card to maintain 16:9 ratio, preventing collapse/overlap */
        aspect-ratio: 16 / 9; 
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        border: 3px solid transparent;
        box-sizing: border-box;
    }

    .board-card.selected {
        border-color: var(--token-color-focusring);
        box-shadow: 0 0 0 2px var(--token-color-surface-base), 0 0 0 4px var(--token-color-focusring);
        z-index: 1;
    }

    .board-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    }

    .board-card:focus-visible {
        outline: none;
        box-shadow: 0 0 0 4px var(--token-color-focusring);
    }

    .board-card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .upload-card {
        background-color: var(--token-color-surface-raised-hover);
        border: 3px dashed var(--token-color-border-subtle);
        display: flex;
        flex-direction: column;
    }
    
    .upload-card:hover {
        border-color: var(--token-color-text-subtle);
    }

    .placeholder-image {
        flex: 1;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--token-color-text-subtle);
    }

    .overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
        color: #fff;
        padding: 1rem 0.5rem 0.5rem;
        opacity: 0;
        transition: opacity 0.3s ease;
        display: flex;
        justify-content: center;
        box-sizing: border-box;
    }

    .overlay.static {
        opacity: 1;
        background: rgba(0,0,0,0.05);
        color: var(--token-color-text-normal);
        font-weight: 500;
        padding: 0.5rem;
    }

    .board-card:hover .overlay,
    .board-card.selected .overlay,
    .board-card:focus-within .overlay {
        opacity: 1;
    }

    .author-text {
        font-size: 0.875rem;
    }

    .overlay a {
        color: #fff;
        text-decoration: underline;
        font-weight: bold;
    }
    
    .overlay a:hover {
        text-decoration: none;
    }
</style>