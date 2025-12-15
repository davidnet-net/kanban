<script lang="ts">
	import { onMount } from "svelte";
	import { dndzone } from "svelte-dnd-action";
	import { page } from "$app/state";
	import { writable, get } from "svelte/store";
	import { kanbanapiurl } from "$lib/config";
	import {
		Button,
		Dropdown,
		FlexWrapper,
		Icon,
		IconButton,
		IconDropdown,
		LinkButton,
		Loader,
		Modal,
		Space,
		SplitButton,
		toast,
		accessToken,
		getSessionInfo,
		isAuthenticated,
		refreshAccessToken
	} from "@davidnet/svelte-ui";
	import type { Card, SessionInfo, BoardMeta } from "$lib/types";
	import { goto } from "$app/navigation";
	import CardOverlay from "$lib/components/CardOverlay.svelte";
	import BoardAccess from "$lib/components/BoardAccess.svelte";
	import DayOverlay from "$lib/components/DayOverlay.svelte";
	import { _ } from "svelte-i18n";

	const id = page.params.id;
	let view: "kanban" | "calendar" | "calendardebug" = $state("kanban");
	// Updated type to include new views
	let calendarview: "month" | "workmonth" | "week" | "workweek" | "3day" | "day" | "list" = $state("month");

	let loading = $state(true);

	const boardMeta = writable<BoardMeta | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type List = { id: string; name: string; [key: string]: any };
	const lists = writable<List[]>([]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const cards = writable<{ [listId: string]: any[] }>({});
	let board_favorited = writable(false);
	let common_error: string | null = $state(null);

	// Track which list is currently adding a new card
	const addingCard = writable<{ [listId: string]: boolean }>({});
	const newCardText = writable<{ [listId: string]: string }>({});

	// Track adding a new list
	const addingList = writable(false);
	const newListName = writable("");

	const correlationID = crypto.randomUUID();
	let token = "";

	// Modals
	let showBoardDelModal = $state(false);
	let showBoardLeaveModal = $state(false);
	let authencated = $state(false);
	let can_edit = $state(false);
	let is_owner = $state(false);
	let si: SessionInfo | null = $state(null);

	function showError(msg: string) {
		if (common_error) {
			return;
		}

		toast({
			title: $_("kanban.board.id.error.something_failed"),
			desc: msg,
			icon: "crisis_alert",
			appearance: "danger",
			position: "top-center",
			autoDismiss: 5000
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

	async function loadImage(url: string) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.src = url;
			img.onload = () => resolve(img);
			img.onerror = reject;
		});
	}

	async function fetchBoard() {
		try {
			const res = await fetch(`${kanbanapiurl}board/get`, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				body: JSON.stringify({ id })
			});
			const data = await res.json();
			if (!res.ok) {
				if (data && data.error === "Board not found") {
					common_error = $_("kanban.board.id.error.board_not_found");
				}

				if (data && data.error === "Not board member") {
					common_error = $_("kanban.board.id.error.not_member");
				}

				throw new Error(`HTTP ${res.status}`);
			}

			boardMeta.set(data);
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	}

	async function fetchLists() {
		try {
			const res = await fetch(`${kanbanapiurl}board/lists`, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				body: JSON.stringify({ board_id: id })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			lists.set(data);
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	}

	async function fetchCardsForAllLists() {
		const allLists = get(lists);
		await Promise.all(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			allLists.map(async (list: any) => {
				try {
					const res = await fetch(`${kanbanapiurl}list/cards`, {
						method: "POST",
						credentials: "include",
						headers: {
							"Content-Type": "application/json",
							...(token ? { Authorization: `Bearer ${token}` } : {})
						},
						body: JSON.stringify({ list_id: list.id })
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
					// Sort cards by position
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					data.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
					cards.update((c) => ({ ...c, [list.id]: data }));
				} catch (e) {
					console.warn(e);
					showError($_("kanban.board.id.error.list_cards_failed_load", { values: { list_name: list.name } }));
				}
			})
		);
	}

	onMount(async () => {
		try {
			await refreshAccessToken(correlationID, true, true);
			if (get(accessToken)) {
				if (!(await isAuthenticated(correlationID))) {
					return;
				}
				token = String(get(accessToken));
				authencated = true;

				si = await getSessionInfo(correlationID, false);

				try {
					const data = await authFetch(`${kanbanapiurl}board/is_favorited`, { board_id: id });
					board_favorited.set(data.favorited);
				} catch (e) {
					console.warn(e);
					showError(String(e));
				}
			}

			await fetchBoard();
			await fetchLists();
			await fetchCardsForAllLists();
			await loadCalendar();

			if (authencated && si && $boardMeta?.owner == si?.userId) {
				is_owner = true;
				can_edit = true;
			}

			if (authencated && si && !is_owner) {
				try {
					const data = await authFetch(`${kanbanapiurl}board/am_i_member`, { id });
					can_edit = data.result;
				} catch (e) {
					console.warn(e);
					showError(String(e));
				}
			}

			setupWS(Number(id));

			await loadImage(String($boardMeta?.background_url));

			// Logic to default to list view on mobile for accessibility
			if (window.matchMedia("(max-width: 768px)").matches) {
				calendarview = "3day";
			}
		} finally {
			loading = false;
		}
	});

	let socket: WebSocket;
	function setupWS(boardId: number) {
		const wsProtocol = kanbanapiurl.startsWith("https") ? "wss" : "ws";
		const wsUrl = `${wsProtocol}://${kanbanapiurl.replace(/^https?:\/\//, "")}board/live/${boardId}`;

		socket = new WebSocket(wsUrl);

		socket.onopen = () => console.log("WebSocket connected to board", boardId);

		socket.onmessage = (e) => {
			try {
				const payload = JSON.parse(e.data);
				console.log("Received WS update:", payload);

				switch (payload.type) {
					case "list_update":
						lists.set(payload.lists);
						break;

					case "card_update":
						cards.update((c) => {
							const newState = { ...c };

							// Use either newListId or listId from payload
							const targetListId = String(payload.newListId ?? payload.listId);

							// Step 1: Remove updated/moved cards from any list
							for (const listId in newState) {
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								newState[listId] = newState[listId].filter((card) => !payload.cards.some((updated: any) => updated.id === card.id));
							}

							// Step 2: Merge updated cards into the target list
							newState[targetListId] = [...(newState[targetListId] || []), ...payload.cards];

							return newState;
						});
						break;

					case "card_delete": {
						const deletedCardId = String(payload.card_id);
						console.log("card_delete payload:", payload);

						cards.update((currentCards) => {
							const updatedCards: { [k: string]: any[] } = {};

							for (const listId of Object.keys(currentCards)) {
								const listCards = currentCards[listId] || [];
								// normalize card.id to string for comparison
								updatedCards[listId] = listCards.filter((card) => String(card.id) !== deletedCardId);
							}

							return updatedCards;
						});

						break;
					}

					default:
						console.log("Unknown payload", payload);
				}
			} catch (err) {
				console.error("Failed to parse WS message", err);
			}
		};

		socket.onerror = (err) => console.error("WebSocket error", err);

		socket.onclose = () => {
			console.log("WebSocket closed. Reconnecting in 2s...");
			setTimeout(() => setupWS(boardId), 2000);
		};
	}

	// --- Local add card ---
	function addCard(listId: string) {
		addingCard.update((a) => ({ ...a, [listId]: true }));
		newCardText.update((t) => ({ ...t, [listId]: "" }));
	}

	async function confirmNewCard(listId: string) {
		const t = get(newCardText);
		const text = t[listId]?.trim();

		// Remove input if empty
		if (!text) {
			addingCard.update((a) => ({ ...a, [listId]: false }));
			newCardText.update((t) => ({ ...t, [listId]: "" }));
			return;
		}

		if (text.length > 100) {
			showError($_("kanban.board.id.error.card_title_too_long"));
			return;
		}

		const tempId = crypto.randomUUID();

		// Optimistically add card locally
		cards.update((c) => ({
			...c,
			[listId]: [...(c[listId] || []), { id: tempId, name: text, isLoading: true }]
		}));

		addingCard.update((a) => ({ ...a, [listId]: false }));
		newCardText.update((t) => ({ ...t, [listId]: "" }));

		try {
			const newCard = await authFetch(`${kanbanapiurl}card/add`, {
				list_id: listId,
				name: text
			});

			// Replace the temporary card with the real one
			cards.update((c) => ({
				...c,
				[listId]: c[listId].map((card) => (card.id === tempId ? newCard : card))
			}));
		} catch (err) {
			console.error(err);
			// Remove temporary card on failure
			cards.update((c) => ({
				...c,
				[listId]: c[listId].filter((card) => card.id !== tempId)
			}));
			showError(`Failed to create card: ${err}`);
		}
	}

	// --- Add list ---
	async function confirmNewList() {
		const name = get(newListName)?.trim();
		if (!name) return;

		const tempId = crypto.randomUUID();
		lists.update((l) => [...l, { id: tempId, name }]);
		addingList.set(false);
		newListName.set("");

		try {
			const newList = await authFetch(`${kanbanapiurl}list/add`, {
				board_id: id,
				name
			});

			lists.update((l) => l.map((list) => (list.id === tempId ? newList : list)));
		} catch (err) {
			console.error(err);
			lists.update((l) => l.filter((list) => list.id !== tempId));
			showError($_("kanban.board.id.error.create_list_failed"));
		}
	}

	function autoFocus(node: HTMLInputElement) {
		setTimeout(() => node.focus(), 0);
		return { destroy() {} };
	}

	function autoFocusInput(node: HTMLInputElement) {
		setTimeout(() => node.focus(), 0);
		return { destroy() {} };
	}

	async function moveList(e: CustomEvent<{ items: List[] }>) {
		const newOrder = e.detail.items.map((item, index) => ({
			...item,
			position: index + 1
		}));

		lists.set(newOrder);

		try {
			await authFetch(`${kanbanapiurl}list/move`, {
				board_id: id,
				lists: newOrder.map(({ id, position }) => ({ id, position }))
			});
		} catch (err) {
			console.error("Failed to move lists:", err);
			showError($_("kanban.board.id.error.move_list_failed"));

			// Reset
			await fetchLists();
		}
	}

	async function moveCard(e: CustomEvent<{ items: any[]; info?: any }>, sourceListId: string) {
		const updatedCards = e.detail.items;

		// Update local store immediately
		cards.update((c) => ({ ...c, [sourceListId]: updatedCards }));

		try {
			// Send updated positions to backend
			await Promise.all(
				updatedCards.map((card, index) =>
					authFetch(`${kanbanapiurl}card/move`, {
						card_id: card.id,
						list_id: sourceListId,
						position: index
					})
				)
			);
		} catch (err) {
			console.error("Failed to move cards:", err);
			showError($_("kanban.board.id.error.card_move_failed"));

			// Reset cards from backend
			await fetchCardsForAllLists();
		}
	}

	async function toggleFav(toggleto: boolean) {
		if (toggleto) {
			try {
				await authFetch(`${kanbanapiurl}board/favorite`, { board_id: id });
				board_favorited.set(toggleto);
				toast({
					title: $_("kanban.board.id.toast.favorited_board.title"),
					desc: $boardMeta?.name ?? id,
					icon: "family_star",
					appearance: "success",
					position: "bottom-left",
					autoDismiss: 5000
				});
			} catch (e) {
				console.warn(e);
				showError(String(e));
			}
		} else {
			try {
				await authFetch(`${kanbanapiurl}board/unfavorite`, { board_id: id });
				board_favorited.set(toggleto);
				toast({
					title: $_("kanban.board.id.toast.unfavorited_board.title"),
					desc: $boardMeta?.name ?? id,
					icon: "kid_star",
					appearance: "success",
					position: "bottom-left",
					autoDismiss: 5000
				});
			} catch (e) {
				console.warn(e);
				showError(String(e));
			}
		}
	}

	async function DeleteBoard() {
		try {
			await authFetch(`${kanbanapiurl}board/delete`, { board_id: id });
			toast({
				title: $_("kanban.board.id.toast.deleted_board.title"),
				desc: $boardMeta?.name ?? id,
				icon: "delete_forever",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
			showBoardDelModal = false;
			goto("/");
		} catch (e) {
			console.warn(e);
			showError(String(e));
		}
	}

	async function LeaveBoard() {
		await authFetch(`${kanbanapiurl}board/leave`, { board_id: id });
		toast({
			title: $_("kanban.board.id.toast.left_board.title"),
			desc: $boardMeta?.name ?? id,
			icon: "door_open",
			appearance: "success",
			position: "bottom-left",
			autoDismiss: 5000
		});
		showBoardLeaveModal = false;
		goto("/");
	}

	async function deleteList(list_id: number, list_name: string) {
		try {
			await authFetch(`${kanbanapiurl}list/delete`, { board_id: id, list_id });
			toast({
				title: $_("kanban.board.id.toast.deleted_board.title"),
				desc: list_name,
				icon: "delete_forever",
				appearance: "success",
				position: "bottom-left",
				autoDismiss: 5000
			});
		} catch (e) {
			console.warn(e);
			showError(String(e));
		} finally {
			await fetchLists();
		}
	}

	async function moveListLeft(list_id: number) {
		const currentLists = get(lists);
		const index = currentLists.findIndex((l) => Number(l.id) === list_id);
		if (index > 0) {
			// swap with the previous one
			const newOrder = [...currentLists];
			[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
			lists.set(newOrder);

			try {
				await authFetch(`${kanbanapiurl}list/move`, {
					board_id: id,
					lists: newOrder.map((l, idx) => ({ id: l.id, position: idx + 1 }))
				});
			} catch (err) {
				console.error("Failed to move list left:", err);
				showError($_("kanban.board.id.error.move_list_failed"));
				await fetchLists();
			}
		}
	}

	async function moveListRight(list_id: number) {
		const currentLists = get(lists);
		const index = currentLists.findIndex((l) => Number(l.id) === list_id);
		if (index >= 0 && index < currentLists.length - 1) {
			// swap with the next one
			const newOrder = [...currentLists];
			[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
			lists.set(newOrder);

			try {
				await authFetch(`${kanbanapiurl}list/move`, {
					board_id: id,
					lists: newOrder.map((l, idx) => ({ id: l.id, position: idx + 1 }))
				});
			} catch (err) {
				console.error("Failed to move list right:", err);
				showError($_("kanban.board.id.error.move_list_failed"));
				await fetchLists();
			}
		}
	}

	let openedCard: Card | null = $state(null);
	let openedDay: Date | null = $state(null);
	let BoardAccessOverlayOpen: boolean = $state(false);

	// ----
	// Calendar
	// ----
	const today: Date = new Date();
	// Centralized date state to handle week/month navigation unified
	let currentDate: Date = $state(new Date());

	let year = $derived(currentDate.getFullYear());
	let month = $derived(currentDate.getMonth());

	let firstDayPref: string = $state("monday");

	async function loadCalendar() {
		firstDayPref = si?.preferences.firstDay ?? "monday";
	}

	const MONTHS = [
		$_("kanban.dates.month.january"),
		$_("kanban.dates.month.february"),
		$_("kanban.dates.month.march"),
		$_("kanban.dates.month.april"),
		$_("kanban.dates.month.may"),
		$_("kanban.dates.month.june"),
		$_("kanban.dates.month.july"),
		$_("kanban.dates.month.august"),
		$_("kanban.dates.month.september"),
		$_("kanban.dates.month.october"),
		$_("kanban.dates.month.november"),
		$_("kanban.dates.month.december")
	];

	function formatViewDate(date: Date | null, mode: "short" | "long"): string {
		if (!date) return "";

		let timezone = "UTC";
		// Default base format
		let dateFormat = "DD-MM-YYYY";

		if (si?.preferences) {
			timezone = si.preferences.timezone || timezone;
			if (si.preferences.dateFormat) {
				// We only want the date part for headers (remove HH:mm if present)
				dateFormat = si.preferences.dateFormat.split(" ")[0];
			}
		}

		try {
			// 1. Get the parts using the user's Timezone
			const parts = new Intl.DateTimeFormat("en-US", {
				timeZone: timezone,
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				weekday: mode === "long" ? "long" : "short"
			})
				.formatToParts(date)
				.reduce(
					(acc, part) => {
						if (part.type !== "literal") acc[part.type] = part.value;
						return acc;
					},
					{} as Record<string, string>
				);

			const { day, month, year, weekday } = parts;

			// 2. Construct the date string based on preferences
			let dateStr = "";
			const fmt = dateFormat.toUpperCase();

			if (fmt.startsWith("MM")) {
				// MM-DD-YYYY
				dateStr = `${month}-${day}-${year}`;
			} else if (fmt.startsWith("YYYY")) {
				// YYYY-MM-DD
				dateStr = `${year}-${month}-${day}`;
			} else {
				// Default or DD-MM-YYYY
				dateStr = `${day}-${month}-${year}`;
			}

			// 3. Return combined string (e.g. "Mon 23-10-2023" or "Monday 23-10-2023")
			return `${weekday} ${dateStr}`;
		} catch (err) {
			console.warn("formatViewDate error", err);
			return date.toDateString();
		}
	}

	const DAYS = $derived(() => {
		const sundayStart = [
			$_("kanban.dates.day.sun"),
			$_("kanban.dates.day.mon"),
			$_("kanban.dates.day.tue"),
			$_("kanban.dates.day.wed"),
			$_("kanban.dates.day.thu"),
			$_("kanban.dates.day.fri"),
			$_("kanban.dates.day.sat")
		];
		const mondayStart = [
			$_("kanban.dates.day.mon"),
			$_("kanban.dates.day.tue"),
			$_("kanban.dates.day.wed"),
			$_("kanban.dates.day.thu"),
			$_("kanban.dates.day.fri"),
			$_("kanban.dates.day.sat"),
			$_("kanban.dates.day.sun")
		];

		// Custom dynamic headers for 3-day and 1-day views
		if (calendarview === "3day" || calendarview === "day") {
			// Generate array based on current grid
			const grid = getCalendarGrid(currentDate, firstDayPref, calendarview);

			// --- CHANGED HERE: Use formatViewDate instead of .locale ---
			return grid.map((d) => formatViewDate(d, "short"));
		}

		// For List view, we can just return a single header or handle it in the UI
		if (calendarview === "list") {
			return [$_("kanban.board.id.dropdown.viewcalendar.list") || "Agenda"];
		}

		let days = firstDayPref === "monday" ? mondayStart : sundayStart;

		// In work month/work week, we always want Mon-Fri regardless of 'firstDayPref'
		if (calendarview === "workmonth" || calendarview === "workweek") {
			return mondayStart.slice(0, 5);
		}

		return days;
	});

	const MONTHDAYS = $derived((year: number) => {
		function isLeapYear(year: number): boolean {
			return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
		}

		const leap = isLeapYear(year);
		const monthDays: number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		const monthDaysLeap: number[] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

		if (leap) {
			return monthDaysLeap;
		} else {
			return monthDays;
		}
	});

	function getFirstDayIndex(year: number, month: number, firstDayPref: string): number {
		const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday, ...
		if (firstDayPref === "monday") {
			// Shift so Monday = 0
			return firstDay === 0 ? 6 : firstDay - 1;
		}
		return firstDay; // Sunday = 0
	}

	// Navigation logic
	function prevInterval() {
		const newDate = new Date(currentDate);
		if (calendarview === "week" || calendarview === "workweek") {
			newDate.setDate(newDate.getDate() - 7);
		} else if (calendarview === "3day") {
			newDate.setDate(newDate.getDate() - 3);
		} else if (calendarview === "day") {
			newDate.setDate(newDate.getDate() - 1);
		} else if (calendarview === "list") {
			newDate.setDate(newDate.getDate() - 7); // Move list back by a week
		} else {
			newDate.setMonth(newDate.getMonth() - 1);
		}
		currentDate = newDate;
	}

	function nextInterval() {
		const newDate = new Date(currentDate);
		if (calendarview === "week" || calendarview === "workweek") {
			newDate.setDate(newDate.getDate() + 7);
		} else if (calendarview === "3day") {
			newDate.setDate(newDate.getDate() + 3);
		} else if (calendarview === "day") {
			newDate.setDate(newDate.getDate() + 1);
		} else if (calendarview === "list") {
			newDate.setDate(newDate.getDate() + 7); // Move list forward by a week
		} else {
			newDate.setMonth(newDate.getMonth() + 1);
		}
		currentDate = newDate;
	}

	function goToToday() {
		currentDate = new Date();
	}

	function getCalendarGrid(
		currentDate: Date,
		firstDayPref: string,
		view: "month" | "workmonth" | "week" | "workweek" | "3day" | "day" | "list"
	): (Date | null)[] {
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth();
		const grid: (Date | null)[] = [];

		if (view === "month") {
			const monthDays = MONTHDAYS(currentYear);
			const daysInMonth = monthDays[currentMonth];
			// --- STANDARD MONTH LOGIC ---
			const firstDayIndex = getFirstDayIndex(currentYear, currentMonth, firstDayPref);

			// Empty slots before the 1st
			for (let i = 0; i < firstDayIndex; i++) {
				grid.push(null);
			}

			// Fill days
			for (let day = 1; day <= daysInMonth; day++) {
				grid.push(new Date(currentYear, currentMonth, day));
			}

			// Pad to 42 (6 rows * 7 cols)
			while (grid.length < 42) {
				grid.push(null);
			}
		} else if (view === "workmonth") {
			const monthDays = MONTHDAYS(currentYear);
			const daysInMonth = monthDays[currentMonth];
			// --- WORK MONTH LOGIC (Mon-Fri) ---

			// 1. Calculate Padding
			const firstDayObj = new Date(currentYear, currentMonth, 1);
			const firstDayOfWeek = firstDayObj.getDay(); // 0=Sun, 1=Mon...

			let padding = 0;
			// If it starts on Mon-Fri, calculate how many empty slots before it.
			// Mon(1)=0 padding, Tue(2)=1 padding, ... Fri(5)=4 padding.
			if (firstDayOfWeek > 0 && firstDayOfWeek < 6) {
				padding = firstDayOfWeek - 1;
			}
			// If it starts on Sat(6) or Sun(0), padding is 0 because the first displayed day will be the next Monday.

			for (let i = 0; i < padding; i++) {
				grid.push(null);
			}

			// 2. Fill Days (Skipping Sat/Sun)
			for (let day = 1; day <= daysInMonth; day++) {
				const date = new Date(currentYear, currentMonth, day);
				const dw = date.getDay();
				// 0 is Sun, 6 is Sat
				if (dw !== 0 && dw !== 6) {
					grid.push(date);
				}
			}

			// 3. Pad to closest row end (multiples of 5)
			// Ensure we have at least 5 rows worth of cells so the height doesn't jump too drastically
			while (grid.length % 5 !== 0 || grid.length < 25) {
				grid.push(null);
			}
		} else if (view === "3day") {
			// --- 3 DAY LOGIC ---
			const startDay = new Date(currentDate);
			for (let i = 0; i < 3; i++) {
				const day = new Date(startDay);
				day.setDate(startDay.getDate() + i);
				grid.push(day);
			}
		} else if (view === "day") {
			// --- 1 DAY LOGIC ---
			grid.push(new Date(currentDate));
		} else if (view === "list") {
			// --- LIST LOGIC (Show next 14 days vertically) ---
			const startDay = new Date(currentDate);
			for (let i = 0; i < 14; i++) {
				const day = new Date(startDay);
				day.setDate(startDay.getDate() + i);
				grid.push(day);
			}
		} else {
			// --- WEEK & WORKWEEK LOGIC ---
			const startOfWeek = new Date(currentDate);

			// Calculate start of the week based on preference
			const dayIdx = startOfWeek.getDay(); // 0-6 (Sun-Sat)
			let diff = 0;

			if (firstDayPref === "monday") {
				// If Monday is start: Mon=0, Sun=6
				const monIndex = dayIdx === 0 ? 6 : dayIdx - 1;
				diff = startOfWeek.getDate() - monIndex;
			} else {
				// If Sunday is start: Sun=0, Sat=6
				diff = startOfWeek.getDate() - dayIdx;
			}
			startOfWeek.setDate(diff);

			// Generate 7 days
			for (let i = 0; i < 7; i++) {
				const day = new Date(startOfWeek);
				day.setDate(startOfWeek.getDate() + i);

				// Filter for Work Week (skip Sun=0 and Sat=6)
				if (view === "workweek") {
					const d = day.getDay();
					if (d !== 0 && d !== 6) {
						grid.push(day);
					}
				} else {
					grid.push(day);
				}
			}
		}

		return grid;
	}

	// Helper: format a Date object to "YYYY-MM-DD" key
	function getDateKey(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, "0");
		const d = String(date.getDate()).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}

	// Helper: Generate array of "YYYY-MM-DD" keys between two dates
	function getDateRange(startStr: string, endStr: string): string[] {
		const start = new Date(startStr);
		const end = new Date(endStr);
		const keys: string[] = [];

		// Safety check: prevent infinite loops if data is bad
		if (start > end) return [getDateKey(start)];

		const current = new Date(start);
		while (current <= end) {
			keys.push(getDateKey(current));
			current.setDate(current.getDate() + 1);
		}
		return keys;
	}

	// This creates a Map where Key="2023-10-01" and Value=[Card, Card]
	// It automatically updates whenever $cards changes.
	const calendarData = $derived.by(() => {
		const map = new Map<string, Card[]>();

		// 1. Flatten the store: Get all cards from all lists
		// $cards is { [listId]: Card[] }, so we grab Object.values
		const allCards = Object.values($cards).flat();

		// 2. Iterate and Bucket
		for (const card of allCards) {
			// Skip cards with no dates
			if (!card.start_date && !card.due_date) continue;

			const dateKeys: string[] = [];

			// SCENARIO A: Range (Start to Due) - Show on all days
			if (card.start_date && card.due_date) {
				dateKeys.push(...getDateRange(card.start_date, card.due_date));
			}
			// SCENARIO B: Due Date Only (Single Point)
			else if (card.due_date) {
				dateKeys.push(getDateKey(new Date(card.due_date)));
			}
			// SCENARIO C: Start Date Only (Single Point)
			else if (card.start_date) {
				dateKeys.push(getDateKey(new Date(card.start_date)));
			}

			// 3. Assign card to every relevant date key
			for (const key of dateKeys) {
				if (!map.has(key)) {
					map.set(key, []);
				}
				map.get(key)!.push(card);
			}
		}

		return map;
	});

	const headerTitle = $derived(() => {
		if (calendarview === "week" || calendarview === "workweek") {
			// Basic week title logic, e.g. "Oct 2023" or "Sep - Oct 2023"
			return `${MONTHS[month]} ${year}`;
		}
		return `${MONTHS[month]} ${year}`;
	});

	// Helper for grid styling logic
	function getGridTemplateColumns(view: string): string {
		if (view === "workmonth" || view === "workweek") return "repeat(5, 1fr)";
		if (view === "3day") return "repeat(3, 1fr)";
		if (view === "day" || view === "list") return "1fr";
		return "repeat(7, 1fr)";
	}

	function getGridTemplateRows(view: string): string {
		if (view.includes("week") || view === "3day" || view === "day") return "1fr";
		if (view === "list") return "repeat(auto-fill, minmax(100px, max-content))";
		return "repeat(6, 1fr)";
	}
</script>

{#if loading}
	<p class="loading-text">{$_("kanban.board.id.title.loading", { values: { board_name: $boardMeta?.name ?? id } })}</p>
	<Loader />
	<p>{$_("kanban.board.id.title.getting_ready")}</p>
{:else if common_error}
	<Icon size="3rem;" color="var(--token-color-text-danger);" icon="crisis_alert" />
	<p class="loading-text">{common_error}</p>
	<LinkButton appearance="primary" href="/">{$_("kanban.board.id.btn.my_boards")}</LinkButton>
	<Space height="var(--token-space-3);" />
	<Button
		onClick={() => {
			history.back();
		}}>{$_("kanban.board.id.btn.back")}</Button
	>
{:else}
	<div class="board" style="background-image: url({$boardMeta?.background_url});">
		<nav id="board-nav">
			<div class="nav-left">
				<h2>{$boardMeta?.name ?? id}</h2>
				<Space width="var(--token-space-4)" />
				<Dropdown
					iconbefore="view_kanban"
					actions={[
						{ label: "Kanban", value: "kanban" },
						{ label: $_("kanban.board.id.dropdown.view.calendar"), value: "calendar" }
					]}
					bind:value={view}
					appearance="subtle"
					alwaysshowslot
				>
					{$_("kanban.board.id.dropdown.view.label")}
				</Dropdown>
			</div>
			<div class="nav-center"></div>
			<div class="nav-right">
				{#if $board_favorited}
					<IconButton
						appearance="warning"
						alt={$_("kanban.board.id.btn.remove_favorite")}
						onClick={() => toggleFav(false)}
						icon="star_shine"
						disabled={!authencated}
					/>
				{:else}
					<IconButton
						appearance="subtle"
						alt={$_("kanban.board.id.btn.add_favorite")}
						onClick={() => toggleFav(true)}
						icon="star"
						disabled={!authencated}
					/>
				{/if}

				{#if can_edit && !is_owner}
					<IconDropdown
						appearance="subtle"
						icon="more_horiz"
						alt={$_("kanban.board.id.dropdown.board_more_actions.label")}
						actions={[
							{
								label: $_("kanban.board.id.dropdown.board_more_actions.leave_board"),
								onClick: () => {
									showBoardLeaveModal = true;
								}
							}
						]}
					/>
				{:else}
					<Button
						appearance="discover"
						iconbefore="group_add"
						onClick={() => {
							BoardAccessOverlayOpen = true;
						}}
						disabled={!is_owner}>{$_("kanban.board.id.btn.share")}</Button
					>
					<IconDropdown
						appearance="subtle"
						icon="more_horiz"
						alt={$_("kanban.board.id.dropdown.board_more_actions.label")}
						disabled={!is_owner}
						actions={[
							{
								label: $_("kanban.board.id.dropdown.board_more_actions.delete_board"),
								onClick: () => {
									showBoardDelModal = true;
								}
							},
							{
								label: $_("kanban.board.id.dropdown.board_more_actions.edit_board"),
								onClick: () => {
									goto("/board/" + id + "/edit");
								}
							},
							{
								label: $_("kanban.board.id.dropdown.board_more_actions.change_background"),
								onClick: () => {
									goto("/board/" + id + "/background");
								}
							}
						]}
					/>
				{/if}
			</div>
		</nav>
		{#if view === "kanban"}
			<div
				class="lists"
				use:dndzone={{
					items: $lists,
					flipDurationMs: 300,
					dropFromOthersDisabled: true,
					dropTargetStyle: { border: "2px dashed rgba(128, 128, 128, 0.5)" },
					type: "list",
					delayTouchStart: true
				}}
				onconsider={(e) => lists.set(e.detail.items)}
				onfinalize={moveList}
			>
				{#each $lists as list (list.id)}
					<div class="list">
						<div class="list-header">
							<h3 class="list-title">{list.name}</h3>
							<IconDropdown
								appearance="subtle"
								icon="more_horiz"
								alt={$_("kanban.board.id.dropdown.list_more_actions.label")}
								disabled={!can_edit}
								actions={[
									{
										label: $_("kanban.board.id.dropdown.list_more_actions.move_left"),
										onClick: () => {
											moveListLeft(Number(list.id));
										}
									},
									{
										label: $_("kanban.board.id.dropdown.list_more_actions.move_right"),
										onClick: () => {
											moveListRight(Number(list.id));
										}
									},
									{
										label: $_("kanban.board.id.dropdown.list_more_actions.delete_list"),
										onClick: () => {
											deleteList(Number(list.id), list.name);
										}
									},
									{
										label: $_("kanban.board.id.btn.add_new_card"),
										onClick: () => {
											addCard(list.id);
										}
									}
								]}
							/>
						</div>

						<div
							class="cards"
							use:dndzone={{
								items: $cards[list.id] ?? [],
								flipDurationMs: 300,
								type: "card",
								dropTargetStyle: { border: "2px dashed rgba(128, 128, 128, 0.5)" },
								delayTouchStart: true
							}}
							onconsider={(e) => cards.update((c) => ({ ...c, [list.id]: e.detail.items }))}
							onfinalize={(e) => moveCard(e, list.id)}
						>
							{#each $cards[list.id] ?? [] as card (card.id)}
								<div
									class="card"
									data-id={card.id}
									Onclick={() => {
										openedCard = card;
									}}
								>
									<FlexWrapper alignitems="flex-start" justifycontent="flex-start" gap="var(--token-space-2)">
										{#if !true}
											<FlexWrapper direction="row" gap="var(--token-space-1)" alignitems="center" justifycontent="flex-start">
												<div class="tag"></div>
											</FlexWrapper>
										{/if}
										{card.name}
										{#if card.description || card.start_date || card.due_date}
											<FlexWrapper direction="row" gap="var(--token-space-1)" alignitems="center" justifycontent="flex-start">
												{#if card.description}
													<Icon icon="text_ad" />
												{/if}
												{#if card.start_date || card.due_date}
													{@const today = new Date().toISOString().slice(0, 10)}

													<Icon
														icon="alarm"
														color={/* 1. If Due Today -> RED */
														card.due_date?.slice(0, 10) === today
															? "var(--token-color-text-danger);"
															: /* 2. If Today is between Start and Due -> BLUE */
																  card.start_date &&
																  today >= card.start_date.slice(0, 10) &&
																  today <= card.due_date?.slice(0, 10)
																? "var(--token-color-text-info);" // Assuming this is your blue
																: undefined}
													/>
												{/if}
											</FlexWrapper>
										{/if}
									</FlexWrapper>
								</div>
							{/each}

							{#if $addingCard[list.id]}
								<input
									class="card new-card-input"
									bind:value={$newCardText[list.id]}
									placeholder={$_("kanban.board.id.field.new_card.placeholder")}
									onkeydown={(e) => e.key === "Enter" && confirmNewCard(list.id)}
									onblur={() => confirmNewCard(list.id)}
									use:autoFocus
								/>
							{/if}
						</div>

						<div class="card-footer">
							<FlexWrapper direction="row" justifycontent="center" alignitems="center" width="100%">
								<SplitButton
									appearance="subtle"
									onClick={() => addCard(list.id)}
									actions={[
										{ label: "Option A", onClick: () => {} },
										{ label: "Option B", onClick: () => {} }
									]}
								>
									{$_("kanban.board.id.btn.add_new_card")}
								</SplitButton>
							</FlexWrapper>
						</div>
					</div>
				{/each}

				<div class="add-list">
					{#if $addingList}
						<input
							bind:value={$newListName}
							class="new-list-input"
							placeholder={$_("kanban.board.id.field.new_list.placeholder")}
							onkeydown={(e) => e.key === "Enter" && confirmNewList()}
							onblur={confirmNewList}
							use:autoFocusInput
						/>
					{:else}
						<Button appearance="subtle" onClick={() => addingList.set(true)}>{$_("kanban.board.id.btn.add_new_list")}</Button>
					{/if}
				</div>
			</div>
		{:else if view === "calendar"}
			<Space height="var(--token-space-4)" />
			<FlexWrapper height="100%" width="100%">
				<div class="calendar-container">
					<div class="calendar-header">
						<IconButton icon="chevron_backward" alt="Previous" onClick={prevInterval} />
						<h2>{headerTitle()}</h2>
						<FlexWrapper direction="row" gap="var(--token-space-1)">
							<Dropdown
								iconbefore="calendar_view_month"
								actions={[
									{ label: $_("kanban.board.id.dropdown.viewcalendar.month"), value: "month" },
									{ label: $_("kanban.board.id.dropdown.viewcalendar.workmonth"), value: "workmonth" },
									{ label: $_("kanban.board.id.dropdown.viewcalendar.week"), value: "week" },
									{ label: $_("kanban.board.id.dropdown.viewcalendar.workweek"), value: "workweek" },
									{ label: $_("kanban.board.id.dropdown.viewcalendar.3days"), value: "3day" },
									{ label: $_("kanban.board.id.dropdown.viewcalendar.day"), value: "day" }
								]}
								bind:value={calendarview}
								appearance="subtle"
								alwaysshowslot
							>
								{$_("kanban.board.id.dropdown.view.label")}
							</Dropdown>
							<Button onClick={goToToday}>{$_("kanban.board.id.btn.today")}</Button>
							<IconButton icon="chevron_forward" alt="Next" onClick={nextInterval} />
						</FlexWrapper>
					</div>

					<div class="calendar-row" style="grid-template-columns: {getGridTemplateColumns(calendarview)};">
						{#each DAYS() as day}
							<div class="calendar-cell header">{day}</div>
						{/each}
					</div>

					<div
						class="calendar-grid {calendarview === 'list' ? 'list-view' : ''}"
						style="grid-template-columns: {getGridTemplateColumns(calendarview)}; grid-template-rows: {getGridTemplateRows(
							calendarview
						)};"
					>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						{#each getCalendarGrid(currentDate, firstDayPref, calendarview) as dateCell}
							{@const dateKey = dateCell ? getDateKey(dateCell) : ""}
							{@const dayCards = dateKey ? calendarData.get(dateKey) : []}
							{@const dayNum = dateCell ? dateCell.getDate() : null}
							{@const isToday =
								dateCell &&
								dayNum === today.getDate() &&
								dateCell.getMonth() === today.getMonth() &&
								dateCell.getFullYear() === today.getFullYear()}

							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								class="calendar-cell {isToday ? 'today' : ''} {calendarview === 'list' ? 'list-mode-cell' : ''}"
								onclick={() => {
									if (dateCell) {
										openedDay = dateCell;
									}
								}}
							>
								{#if dateCell}
									<FlexWrapper height="100%" width="100%" direction="column" gap="4px">
										{#if calendarview === "list"}
											<span class="day-number list-header">
												{formatViewDate(dateCell, "long")}
											</span>
										{:else}
											<span class="day-number">{dayNum}</span>
										{/if}

										<FlexWrapper
											height="100%"
											width="100%"
											direction="column"
											gap="var(--token-space-1)"
											overflowY="scroll"
											justifycontent="flex-start"
										>
											<Space height="var(--token-space-1)" />
											{#if dayCards}
												{#each dayCards as card}
													<Button
														appearance="primary"
														stretchwidth
														onClick={(e) => {
															e.stopPropagation();
															openedCard = card;
														}}
													>
														{card.name}
													</Button>
												{/each}
											{/if}
										</FlexWrapper>
									</FlexWrapper>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</FlexWrapper>
		{:else}
			<h1>{$_("kanban.board.id.title.unhandled_view")}</h1>
			<Loader />
		{/if}
	</div>
{/if}

{#if showBoardDelModal}
	<Modal
		title={$_("kanban.board.id.modal.BoardDelModal.title", { values: { board_name: $boardMeta?.name ?? id } })}
		titleIcon="delete_forever"
		desc={$_("kanban.board.id.modal.BoardDelModal.desc")}
		hasCloseBtn
		on:close={() => (showBoardDelModal = false)}
		options={[
			{
				appearance: "subtle",
				content: $_("kanban.board.id.modal.BoardDelModal.cancel"),
				onClick: () => (showBoardDelModal = false)
			},
			{ appearance: "danger", content: $_("kanban.board.id.modal.BoardDelModal.delete_board"), onClick: DeleteBoard }
		]}
	/>
{/if}

{#if showBoardLeaveModal}
	<Modal
		title={$_("kanban.board.id.modal.BoardLeaveModal.title", { values: { board_name: $boardMeta?.name ?? id } })}
		titleIcon="door_open"
		desc={$_("kanban.board.id.modal.BoardLeaveModal.desc")}
		hasCloseBtn
		on:close={() => (showBoardLeaveModal = false)}
		options={[
			{
				appearance: "subtle",
				content: $_("kanban.board.id.modal.BoardLeaveModal.cancel"),
				onClick: () => (showBoardLeaveModal = false)
			},
			{ appearance: "danger", content: $_("kanban.board.id.modal.BoardLeaveModal.leave"), onClick: LeaveBoard }
		]}
	/>
{/if}

{#if openedCard}
	<CardOverlay
		closeOverlay={() => {
			openedCard = null;
		}}
		{openedCard}
		{correlationID}
		board_id={Number(id)}
	/>
{/if}

{#if openedDay}
	<DayOverlay
		closeOverlay={() => {
			openedDay = null;
		}}
		date={openedDay}
		allCards={$cards}
		lists={$lists}
		{correlationID}
		board_id={Number(id)}
		onCardSelect={(card) => {
			openedDay = null; // Close the day overlay
			openedCard = card; // Open the card overlay
		}}
	/>
{/if}

{#if BoardAccessOverlayOpen}
	<BoardAccess
		closeOverlay={() => {
			BoardAccessOverlayOpen = false;
		}}
		{correlationID}
		boardOwner={$boardMeta?.owner}
		boardId={Number(id)}
	/>
{/if}

<style>
	.calendar-container {
		display: flex;
		flex-direction: column;
		width: 95%;
		height: 90%;
		border-radius: 1rem;
		flex-grow: 1;
		background: var(--token-color-surface-sunken-normal);
		/* Adjusted padding to be consistent */
		padding: 1rem;
		box-sizing: border-box;
		gap: 0.5rem;
		overflow: hidden;
		/* Removed margin: 0 auto since we want full width */
		margin: 0;
	}

	.calendar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		color: var(--token-color-text-default);
		flex-shrink: 0; /* Prevents header from squishing */
	}

	.calendar-header h2 {
		margin: 0 1rem;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.calendar-row {
		display: grid;
		/* grid-template-columns: repeat(7, 1fr);  <-- Removed to allow inline style override */
		text-align: center;
		margin-bottom: 0.2rem;
		background-color: var(--token-color-surface-overlay-normal);
		border-radius: 0.5rem;
		flex-shrink: 0; /* Prevents days header from squishing */
	}

	.calendar-cell.header {
		font-weight: bold;
		border-radius: 0rem;
		color: var(--token-color-text-default);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 0; /* Added vertical padding for better look */
	}

	.calendar-grid {
		display: grid;
		/* grid-template-columns: repeat(7, 1fr); <-- Removed to allow inline style override */
		/* grid-template-rows: repeat(6, 1fr);  <-- Removed to allow inline style override */
		gap: 0.5rem; /* Increased gap slightly for better separation */
		flex: 1; /* This makes the grid take up all remaining vertical space */
		min-height: 0; /* Crucial for scrolling inside flex children */
		width: 100%;
	}

	.calendar-grid.list-view {
		overflow-y: auto; /* Enable scrolling for the list view */
		display: flex; /* Flex allows easier vertical stacking than grid for variable heights */
		flex-direction: column;
	}

	.calendar-cell {
		border: 1px solid rgba(9, 30, 66, 0.15);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px;
		box-sizing: border-box;
		width: 100%;
		height: 100%; /* Fills the grid row height */
		color: var(--token-color-text-default-secondary);
		background-color: var(--token-color-surface-raised-normal);
		font-weight: 500;
		transition: background 0.2s;
		overflow: hidden; /* Prevent cell itself from scrolling, let inner content scroll */
		position: relative;
		cursor: pointer; /* Indicates it's clickable */
	}

	.calendar-cell.list-mode-cell {
		height: auto;
		min-height: 80px;
		align-items: flex-start; /* Left align text in list mode */
		margin-bottom: 0.5rem;
	}

	.day-number.list-header {
		font-size: 1.1rem;
		font-weight: bold;
		margin-bottom: 0.5rem;
	}

	/* Optional: Style the scrollable content area inside the cell */
	.calendar-cell > :global(div) {
		width: 100%;
	}

	.calendar-cell.today {
		color: var(--token-color-background-primary-normal);
		border: 2px solid var(--token-color-background-primary-normal); /* Highlight border for today */
	}

	.calendar-cell:hover {
		background-color: var(--token-color-surface-raised-hover);
	}

	#board-nav {
		height: 48px;
		width: calc(100% - 3rem);
		background: rgba(103, 155, 151, 0.21);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		padding: 4px;
		color: #fff;
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.5rem;
		z-index: 2;
	}

	#board-nav > div {
		flex: 1;
		display: flex;
		align-items: center;
	}

	.nav-left h2 {
		margin: 0px;
	}

	.nav-center {
		justify-content: center;
	}

	.nav-right {
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.loading-text {
		font-weight: bold;
		font-size: 1.2rem;
	}
	.board {
		height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: var(--token-color-background);
		overflow: hidden;
		padding-bottom: 1rem;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
	}
	.lists {
		display: flex;
		gap: 1.5rem;
		overflow-x: auto;
		padding: 1.5rem;
		flex-grow: 1;
		scroll-behavior: smooth;
	}
	.list {
		background: var(--token-color-surface-sunken-normal);
		min-width: 250px;
		height: fit-content;
		min-height: 10vh;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		padding: 0.4rem;
		border-radius: 1rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		flex-shrink: 0;
	}

	.list-header {
		position: relative; /* allows absolute positioning of button */
		display: flex;
		align-items: center; /* vertical center */
		justify-content: center; /* centers the title */
		padding: 0.5rem; /* optional spacing inside the header */
	}

	.list-title {
		margin: 0px;
		text-align: center;
		flex: 1;
	}

	.add-list {
		background: var(--token-color-surface-sunken-normal);
		min-width: 272px;
		height: fit-content;
		display: flex;
		flex-direction: column;
		padding: 0.4rem;
		border-radius: 1rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		flex-shrink: 0;
		gap: 0.5rem;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
		max-height: 70vh;
		padding: 0 0.25rem;
		min-height: 1vh;
		padding-bottom: 2rem;
		padding-top: 1.5rem;
		max-width: 250px;
		text-wrap: normal;
		word-break: break-all;
	}
	.card {
		background-color: var(--token-color-surface-raised-normal);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		cursor: grab;
		color: var(--token-color-text-default-secondary);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}
	.card:active {
		cursor: grabbing;
		transform: scale(1.02);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.new-card-input,
	.new-list-input {
		background-color: var(--token-color-surface-raised-normal);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 1px 0 rgba(9, 30, 66, 0.25);
		border: none;
		width: 100%;
		font-family: inherit;
		font-size: 1rem;
		color: var(--token-color-text-default-normal);
	}
	.new-card-input:focus,
	.new-list-input:focus {
		outline: 2px solid var(--token-color-focus);
	}
	.card-footer {
		padding-top: var(--token-space-2);
	}

	h2 {
		text-align: center;
		margin-bottom: 1rem;
		font-weight: 600;
		color: var(--token-color-text-default);
	}

	.tag {
		height: 0.5rem;
		width: 1.5rem;
		/*background-color: red;*/
		border-radius: 1rem;
	}
</style>
