<script lang="ts">
	/** Labels for each point along the x-axis, in chronological order. */
	export let labels: string[] = [];
	/** Student's % for each component, same order/length as labels. */
	export let studentValues: number[] = [];
	/** Estimated class average % for each component, or null when not tracked (absolute mode). */
	export let classAvgValues: number[] | null = null;

	const width = 640;
	const height = 260;
	const padding = { top: 20, right: 20, bottom: 44, left: 42 };

	$: innerWidth = width - padding.left - padding.right;
	$: innerHeight = height - padding.top - padding.bottom;
	$: n = labels.length;

	// Each point gets an equal-width slot and sits at its center, so edge
	// labels never spill past the plot and neighbours don't collide.
	$: slotW = innerWidth / Math.max(n, 1);
	function xFor(i: number): number {
		return padding.left + slotW * (i + 0.5);
	}

	// ponytail: ~5.5px per char at 9px mono; good enough without measuring text.
	function wrapLabel(label: string, slot: number): string[] {
		const max = Math.max(4, Math.floor(slot / 5.5));
		const lines: string[] = [];
		let line = '';
		for (const word of label.split(/\s+/)) {
			const next = line ? `${line} ${word}` : word;
			if (next.length <= max || !line) line = next;
			else {
				lines.push(line);
				line = word;
			}
		}
		if (line) lines.push(line);
		const out = lines.slice(0, 2).map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l));
		if (lines.length > 2) out[1] = out[1].slice(0, max - 1) + '…';
		return out;
	}

	function yFor(value: number): number {
		const clamped = Math.max(0, Math.min(100, value));
		return padding.top + innerHeight - (innerHeight * clamped) / 100;
	}

	$: studentPoints = studentValues.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
	$: classAvgPoints = classAvgValues
		? classAvgValues.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ')
		: '';

	const gridLines = [0, 25, 50, 75, 100];
</script>

{#if n === 0}
	<p class="chart-empty">Add marks to your graded components to see a progress chart.</p>
{:else}
	<div class="chart-wrap">
		<svg viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet" class="chart-svg">
			{#each gridLines as g}
				<line
					x1={padding.left}
					x2={width - padding.right}
					y1={yFor(g)}
					y2={yFor(g)}
					class="grid-line"
				/>
				<text x={padding.left - 10} y={yFor(g) + 3} class="axis-label" text-anchor="end">{g}</text>
			{/each}

			{#each labels as label, i}
				<text x={xFor(i)} y={height - padding.bottom + 18} class="axis-label" text-anchor="middle">
					<title>{label}</title>
					{#each wrapLabel(label, slotW) as line, li}
						<tspan x={xFor(i)} dy={li === 0 ? 0 : 11}>{line}</tspan>
					{/each}
				</text>
			{/each}

			{#if classAvgValues}
				<polyline points={classAvgPoints} class="line class-avg-line" />
				{#each classAvgValues as v, i}
					<circle cx={xFor(i)} cy={yFor(v)} r="3.5" class="dot class-avg-dot" />
				{/each}
			{/if}

			<polyline points={studentPoints} class="line student-line" />
			{#each studentValues as v, i}
				<circle cx={xFor(i)} cy={yFor(v)} r="3.5" class="dot student-dot" />
			{/each}
		</svg>

		<div class="chart-legend">
			<span class="legend-item"><span class="legend-swatch student-swatch"></span>Your progress</span>
			{#if classAvgValues}
				<span class="legend-item">
					<span class="legend-swatch class-avg-swatch"></span>Estimated class average
				</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.chart-wrap {
		width: 100%;
	}
	.chart-svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.grid-line {
		stroke: var(--border, #262626);
		stroke-width: 1;
	}
	.axis-label {
		font-family: var(--font-mono, monospace);
		font-size: 9px;
		fill: var(--text-muted, #6b7280);
	}
	.line {
		fill: none;
		stroke-width: 2;
	}
	.student-line {
		stroke: var(--text, #f5f5f5);
	}
	.class-avg-line {
		stroke: var(--text-secondary, #9ca3af);
		stroke-dasharray: 5 4;
	}
	.dot {
		stroke: none;
	}
	.student-dot {
		fill: var(--text, #f5f5f5);
	}
	.class-avg-dot {
		fill: var(--text-secondary, #9ca3af);
	}
	.chart-legend {
		display: flex;
		gap: 1.25rem;
		justify-content: center;
		margin-top: 0.75rem;
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
		color: var(--text-secondary, #9ca3af);
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.legend-swatch {
		width: 14px;
		height: 3px;
		border-radius: 2px;
		display: inline-block;
	}
	.student-swatch {
		background: var(--text, #f5f5f5);
	}
	.class-avg-swatch {
		background: var(--text-secondary, #9ca3af);
	}
	.chart-empty {
		color: var(--text-muted, #6b7280);
		font-size: 0.85rem;
		font-style: italic;
		text-align: center;
		padding: 1.5rem 0;
	}
</style>