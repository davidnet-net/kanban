<script lang="ts">
	import { FlexWrapper, IconButton } from "@davidnet/svelte-ui";

	const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

	export let year: number = new Date().getFullYear();
	export let month: number = new Date().getMonth();

	function isLeapYear(year: number) {
		return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	}

	function getDaysInMonth(year: number, monthIndex: number) {
		const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		if (monthIndex === 1 && isLeapYear(year)) return 29;
		return monthLengths[monthIndex];
	}

	function buildMonthGrid(year: number, monthIndex: number) {
		const daysInMonth = getDaysInMonth(year, monthIndex);
		const firstDay = new Date(year, monthIndex, 1).getDay();

		const weeks: (number | null)[][] = [];
		let currentWeek: (number | null)[] = new Array(7).fill(null);

		for (let d = 0; d < daysInMonth; d++) {
			const dayOfWeek = (firstDay + d) % 7;
			currentWeek[dayOfWeek] = d + 1;

			if (dayOfWeek === 6 || d === daysInMonth - 1) {
				weeks.push(currentWeek);
				currentWeek = new Array(7).fill(null);
			}
		}

		return weeks;
	}

	$: grid = buildMonthGrid(year, month);
</script>

<div class="calendar">
	<FlexWrapper direction="row" width="100%" gap="var(--token-space-3);">
        <IconButton icon="chevron_backward" onClick={()=>{}} alt="Previous month"/>
        <h2>{MONTHS[month]} {year}</h2>
        <IconButton icon="chevron_forward" onClick={()=>{}} alt="Next month"/>
    </FlexWrapper>

	<div class="calendar-grid-header">
		{#each DAYS as day}
			<div class="cell-header">{day}</div>
		{/each}
	</div>

	<div class="calendar-grid-container">
		{#each grid as week}
			<div class="calendar-grid">
				{#each week as day}
					<div class="cell">
						<div class="cell-date">{day ?? ""}</div>
						<div class="cell-content">
							<!-- You can put cards or events here -->
							{#if day}
								<p class="example-event">Test Event</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.calendar {
		width: 80%;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--token-color-surface-sunken-normal);
		padding: 1rem;
		border-radius: 1rem;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
		box-sizing: border-box;
	}

	h2 {
		text-align: center;
		margin-bottom: 1rem;
		font-weight: 600;
		color: var(--token-color-text-default);
	}

	.calendar-grid-header {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		text-align: center;
		margin-bottom: 0.5rem;
	}

	.cell-header {
		font-weight: 600;
		padding: 0.5rem 0;
		border-bottom: 2px solid #ddd;
		color: var(--token-color-text-default);
	}

	.calendar-grid-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
        
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		flex: 1;
		gap: 0.5rem;
        
	}

	.cell {
		
		display: flex;
		flex-direction: column;
		min-height: 100px;
		background: var(--token-color-surface-raised-normal);
		border-radius: 0.5rem;
		padding: 0.5rem;
		box-sizing: border-box;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
		cursor: pointer;
	}

	.cell:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.cell-date {
		font-weight: 600;
		margin-bottom: 0.4rem;
		color: var(--token-color-text-default);
        display: flex;
        flex-direction: row;
        width: 100%;
        justify-content: center;
	}

	.cell-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.example-event {
		background: #e3f2fd;
		color: #0d47a1;
		padding: 0.25rem 0.5rem;
		border-radius: 0.3rem;
		font-size: 0.75rem;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Scrollbar style for better look */
	.calendar-grid-container::-webkit-scrollbar {
		width: 8px;
	}

	.calendar-grid-container::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
	}

	.calendar-grid-container::-webkit-scrollbar-track {
		background: transparent;
	}
</style>
