<script lang="ts">
    import { onMount } from 'svelte';
    import {
        COMPONENT_TYPES,
        needsBestOf,
        attemptLabel,
        componentName,
        createEmptyComponent,
        syncComponentIterations,
        resetToSingleIteration,
        normalizeIterationOrders,
        setIterationOrder,
        // renumberOrders,
        // setComponentOrder,
        type Course,
        type GradedComponent
    } from '$lib/grade';
    import {
        pct,
        totalWeightage,
        studentTotalPct,
        classAvgTotalPct,
        // computeComponentScore
    } from '$lib/gradeCalculations';
    import { generateId } from '$lib/id';
    import ProgressChart from '$lib/components/ProgressChart.svelte';

    export let course: Course;
    export let onRemove: (id: string) => void = () => {};
        // Cleans up saved courses from before `order`/`targetPct` existed.

    onMount(() => {
        if (typeof course.targetPct !== 'number' || course.targetPct < 0) course.targetPct = 0;
        course.components = normalizeIterationOrders(course.components);
    });

    function addComponent() {
        const comp = createEmptyComponent(generateId(`${course.id}-comp`));
        course.components = normalizeIterationOrders([...course.components, comp]);
    }

    function removeComponent(id: string) {
        course.components = normalizeIterationOrders(course.components.filter((c) => c.id !== id));
    }

    function replaceComponent(updated: GradedComponent) {
        course.components = normalizeIterationOrders(
            course.components.map((c) => (c.id === updated.id ? updated : c))
        );
    }

    function onBestOfChange(comp: GradedComponent) {
        replaceComponent(syncComponentIterations(comp, () => generateId(`${comp.id}-iter`)));
    }

    // "best" follows "out of" (n of n) unless the user already picked a smaller
    // number; iterations.length is still the previous total at this point.
    function onBestOfTotalChange(comp: GradedComponent) {
        const prevTotal = comp.iterations.length;
        const total = comp.bestOfTotal;
        if (total != null && Number.isInteger(total) && total >= 1 && total <= 20) {
            if (comp.bestOfCount == null || comp.bestOfCount >= prevTotal || comp.bestOfCount > total) {
                comp.bestOfCount = total;
            }
        }
        onBestOfChange(comp);
    }

    function onTypeChange(comp: GradedComponent) {
        if (!needsBestOf(comp.type)) {
            replaceComponent(resetToSingleIteration(comp));
        } else {
            onBestOfChange(comp);
        }
    }

	function onFutureChange() {
        course.components = normalizeIterationOrders(course.components);
    }

		function markError(
		obtained: number | null,
		total: number | null,
		who: string,
		checkTotal = true
	): { field: 'obtained' | 'total'; msg: string } | null {
		if (total == null || total <= 0) {
			return checkTotal ? { field: 'total', msg: 'Total must be greater than 0' } : null;
		}
		if (obtained == null) return null;
		if (obtained > total) return { field: 'obtained', msg: `${who} cannot be more than the total` };
		return null;
	}

	function bestOfError(
		count: number | null,
		total: number | null
	): { field: 'count' | 'total'; msg: string } | null {
		if (count == null && total == null) return null;
		if (total == null) return { field: 'total', msg: 'Fill in the "out of" number' };
		if (!Number.isInteger(total) || total < 1) {
			return { field: 'total', msg: 'Must be a whole number, at least 1' };
		}
		if (count == null) return null;
		if (!Number.isInteger(count) || count < 1) {
			return { field: 'count', msg: 'Must be a whole number, at least 1' };
		}
		if (count > total) {
			return { field: 'count', msg: 'Best-of number cannot be greater than the total' };
		}
		return null;
	}

	function weightageError(w: number | null): string | null {
		if (w == null) return null;
		if (w > 100) return 'Weightage cannot be more than 100%';
		return null;
	}

	// Attached to the whole card: every number field here is a mark,
	// weightage or count, so none of them can be negative.
	const isNumberInput = (t: EventTarget | null): t is HTMLInputElement =>
		t instanceof HTMLInputElement && t.type === 'number';

	function blockMinus(e: KeyboardEvent) {
		if (isNumberInput(e.target) && ['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
	}

	// Catches what keydown can't: pasting or dropping "-5".
	function stripMinus(e: Event) {
		const el = e.target;
		if (!isNumberInput(el) || !el.value.startsWith('-')) return;
		el.value = el.value.slice(1);
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}

    function onIterationOrderChange(iterationId: string, newOrder: number) {
        course.components = setIterationOrder(course.components, iterationId, newOrder);
    }

    $: weightSum = totalWeightage(course.components);
    // Future components have no marks yet, so they never count toward totals.
    $: gradedComponents = course.components.filter((c) => !c.isFuture);
    $: futureComponents = course.components.filter((c) => c.isFuture);
    $: studentTotal = studentTotalPct(gradedComponents);
    $: classAvgTotal = course.mode === 'relative' ? classAvgTotalPct(gradedComponents) : null;

    // Target gap: points still needed, and the average % that means across
    // the components marked Future (the only marks still up for grabs).
    $: target = Math.min(100, course.targetPct || 0);
    $: futureWeight = totalWeightage(futureComponents);
    $: pointsNeeded = target - studentTotal;
    $: avgNeeded = futureWeight > 0 ? (pointsNeeded / futureWeight) * 100 : null;
    $: futureNames = futureComponents.map(componentName).join(', ');
        // Every individual mark from non-future components, in the student-chosen order.
    $: orderedMarks = course.components
        .filter((c) => !c.isFuture)
        .flatMap((c) =>
            c.iterations.map((it, i) => ({
                order: it.order ?? Number.MAX_SAFE_INTEGER,
                label: c.iterations.length > 1 ? attemptLabel(componentName(c), i + 1) : componentName(c),
                student: pct(it.studentObtained, it.studentTotal),
                classAvg: pct(it.classAvgObtained, it.classAvgTotal)
            }))
        )
        .sort((a, b) => a.order - b.order);

    $: orderOptions = orderedMarks.map((_, idx) => idx + 1);
    $: chartLabels = orderedMarks.map((m) => m.label);
    $: chartStudent = orderedMarks.map((m) => m.student);
    $: chartClassAvg = course.mode === 'relative' ? orderedMarks.map((m) => m.classAvg) : null;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (only filters keys/input bubbling up from the number fields inside) -->
<div class="course-card" on:keydown={blockMinus} on:input={stripMinus}>
    <div class="course-header">
        <input
            class="course-name-input"
            type="text"
            placeholder="Course name (e.g. CSD101)"
            bind:value={course.name}
        />
        <button class="delete-btn" on:click={() => onRemove(course.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
            Delete course
        </button>
    </div>

    <div class="mode-toggle">
        <span class="mode-label">Grading:</span>
        <button
            class="mode-btn"
            class:active={course.mode === 'relative'}
            on:click={() => (course.mode = 'relative')}
        >
            Relative
        </button>
        <button
            class="mode-btn"
            class:active={course.mode === 'absolute'}
            on:click={() => (course.mode = 'absolute')}
        >
            Absolute
        </button>

        <div class="target-field">
            <span class="mode-label">Target:</span>
            <input
                type="number"
                min="0"
                max="100"
                class="mini-input"
				class:invalid={course.targetPct > 100}
                bind:value={course.targetPct}
            />
            <span class="slash">%</span>
        </div>
    </div>
	{#if course.targetPct > 100}
		<p class="field-error target-error">Target cannot be more than 100%</p>
	{/if}

    {#each course.components as comp (comp.id)}
        {@const weightErr = weightageError(comp.weightage)}
		<div class="component-block">
            <div class="comp-top">
                <div class="comp-top-left">
                    <span class="field-label">Graded component</span>
                    <select class="select" bind:value={comp.type} on:change={() => onTypeChange(comp)}>
                        {#each COMPONENT_TYPES as t}
                            <option value={t}>{t}</option>
                        {/each}
                    </select>
                </div>

                {#if comp.type === 'Other'}
                    <label class="name-field">
                        <span class="field-label">Component name</span>
                        <input
                            type="text"
                            class="name-input"
                            placeholder="e.g. Viva"
                            maxlength="40"
                            bind:value={comp.customName}
                        />
                    </label>
                {/if}

                <div class="weightage-field">
                    <span class="field-label">Weightage %</span>
                    <input
						type="number"
						min="0"
						max="100"
						class="mini-input"
						class:invalid={!!weightErr}
						bind:value={comp.weightage}
					/>
                </div>

                <label class="future-checkbox">
                    <input type="checkbox" bind:checked={comp.isFuture} on:change={onFutureChange} />
                    Future component
                </label>

                <!--
                <div class="order-field">
                    <span class="field-label">Order</span>
                    <select
                        class="select order-select"
                        value={comp.order}
                        on:change={(e) => onOrderChange(comp, Number(e.currentTarget.value))}
                    >
                        {#each course.components.map((_, idx) => idx + 1) as n}
                            <option value={n}>{n}</option>
                        {/each}
                    </select>
                </div>
                -->

                <button
                    class="delete-btn icon-only"
                    on:click={() => removeComponent(comp.id)}
                    aria-label="Remove component"
                    title="Remove component"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
                </button>
            </div>

			{#if weightErr}<p class="field-error">{weightErr}</p>{/if}
            {#if !comp.isFuture}
            	{#if needsBestOf(comp.type)}
					{@const bestErr = bestOfError(comp.bestOfCount, comp.bestOfTotal)}
					<div class="best-of-row">
						<span class="field-label">best</span>
						<input
							type="number"
							min="1"
							max={comp.bestOfTotal ?? 1}
							class="mini-input"
							title={(comp.bestOfTotal ?? 1) > 1 ? '' : 'Raise the second number to add attempts first'}
							disabled={(comp.bestOfTotal ?? 1) <= 1}
							class:invalid={bestErr?.field === 'count'}
							bind:value={comp.bestOfCount}
							on:input={() => onBestOfChange(comp)}
						/>
						<span class="slash">/</span>
						<input
							type="number"
							min="1"
							max="20"
							class="mini-input"
							class:invalid={bestErr?.field === 'total'}
							bind:value={comp.bestOfTotal}
							on:input={() => onBestOfTotalChange(comp)}
						/>
					</div>
					{#if bestErr}<p class="field-error best-error">{bestErr.msg}</p>{/if}
				{/if}

                    <div class="marks-table" class:with-avg={course.mode === 'relative'}>
                        <div class="marks-header">
                            <span></span>
                            <span>Your marks</span>
                            {#if course.mode === 'relative'}
                                <span>Estimated class average</span>
                            {/if}
                            <span title="When this was graded, relative to your other marks. Sets the order on the progress chart.">Sequence</span>
                        </div>

                        {#each comp.iterations as it, i (it.id)}
							{@const studentErr = markError(it.studentObtained, it.studentTotal, 'Your marks')}
							{@const avgErr =
								course.mode === 'relative'
									? markError(it.classAvgObtained, it.classAvgTotal, 'Class average', false)
									: null}
							<div class="marks-row">
								<span class="marks-label">
									{comp.iterations.length > 1 ? attemptLabel(componentName(comp), i + 1) : ''}
								</span>

								<div class="marks-input">
									<input
										type="number"
										min="0"
										class="mini-input"
										class:invalid={studentErr?.field === 'obtained'}
										bind:value={it.studentObtained}
									/>
									<span class="slash">/</span>
									<input
										type="number"
										min="0"
										class="mini-input"
										class:invalid={studentErr?.field === 'total'}
										bind:value={it.studentTotal}
										on:input={() => (it.classAvgTotal = it.studentTotal)}
									/>
								</div>

								{#if course.mode === 'relative'}
									<div class="marks-input">
										<input
											type="number"
											min="0"
											class="mini-input"
											class:invalid={avgErr?.field === 'obtained'}
											bind:value={it.classAvgObtained}
										/>
										<span class="slash">/</span>
										<input
											type="number"
											min="0"
											class="mini-input"
											class:invalid={studentErr?.field === 'total'}
											bind:value={it.classAvgTotal}
											on:input={() => (it.studentTotal = it.classAvgTotal)}
										/>
									</div>
								{/if}

								<select
									class="select order-select"
									aria-label="Sequence"
									value={it.order}
									on:change={(e) => onIterationOrderChange(it.id, Number(e.currentTarget.value))}
								>
									{#each orderOptions as n}
										<option value={n}>{n}</option>
									{/each}
								</select>
							</div>
							{#if studentErr}<p class="field-error marks-error">{studentErr.msg}</p>{/if}
							{#if avgErr}<p class="field-error marks-error">{avgErr.msg}</p>{/if}
						{/each}
                    </div>
            {:else}
                <p class="future-note">Future component — nothing to track yet.</p>
            {/if}
        </div>
    {/each}

    <button class="add-btn" on:click={addComponent}>+ Add graded component</button>

    {#if weightSum > 100}
		<p class="weight-warning over">Weightage adds up to {weightSum}%, which is more than 100%</p>
	{:else if weightSum !== 100 && course.components.length > 0}
		<p class="weight-warning">Weightage adds up to {weightSum}% (should total 100%)</p>
	{/if}

    <div class="totals">
        <div class="total-box">
            <span class="total-label">Total</span>
            <span class="total-value student">{studentTotal.toFixed(2)}%</span>
            {#if target > 0}
                <p class="target-hint">
                    {#if pointsNeeded <= 0}
                        ✓ {target}% target reached
                    {:else if avgNeeded === null}
                        Below your {target}% target. Mark upcoming components as <em>Future</em> to
                        see what you need in them.
                    {:else if avgNeeded > 100}
                        {target}% isn't reachable. Even 100% in {futureNames} gets you
                        {(studentTotal + futureWeight).toFixed(1)}%.
                    {:else}
                        To reach {target}%, score
                        {futureComponents.length === 1 ? 'at least' : 'an average of'}
                        <strong>{Math.ceil(avgNeeded)}%</strong>
                        {futureComponents.length === 1 ? 'in' : 'across'} {futureNames}.
                    {/if}
                </p>
            {/if}
        </div>
        {#if course.mode === 'relative' && classAvgTotal !== null}
            <div class="total-box">
                <span class="total-label">Estimated class average total</span>
                <span class="total-value class-avg">{classAvgTotal.toFixed(2)}%</span>
            </div>
        {/if}
    </div>

    <div class="progress-section">
        <h3 class="progress-title">Progress chart</h3>
        <ProgressChart labels={chartLabels} studentValues={chartStudent} classAvgValues={chartClassAvg} />
    </div>
</div>

<style>
	.course-card {
		background: linear-gradient(180deg, var(--bg-card, #0d0d0d), rgba(10, 10, 10, 0.4));
		border: 1px solid var(--border, #262626);
		border-radius: 14px;
		padding: 1.5rem;
		color: var(--text, #e5e7eb);
	}

	.course-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.course-name-input {
		flex: 0 1 260px;
		min-width: 0;
		margin-right: auto;
		background: var(--bg-input, #171717);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 8px;
		padding: 0.45rem 0.7rem;
		color: var(--text, #f5f5f5);
		font-size: 0.95rem;
		font-weight: 600;
		font-family: inherit;
	}

	.course-name-input:focus {
		outline: none;
		border-color: var(--border-hover, #525252);
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		height: 38px;
		padding: 0 0.85rem;
		background: rgba(248, 113, 113, 0.08);
		border: 1px solid rgba(248, 113, 113, 0.45);
		border-radius: 10px;
		color: #f87171;
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}
	.delete-btn svg {
		width: 16px;
		height: 16px;
	}
	.delete-btn:hover,
	.delete-btn:focus-visible {
		background: rgba(248, 113, 113, 0.18);
		border-color: #f87171;
		color: #fca5a5;
		outline: none;
	}
	.delete-btn.icon-only {
		width: 36px;
		height: 36px;
		padding: 0;
	}

	.mode-toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1.5rem;
	}
	.mode-label {
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
		color: #f5f5f5;
	}
	.mode-btn {
		background: var(--bg-input, #171717);
		border: 1px solid var(--border, #2e2e2e);
		color: var(--text-secondary, #a3a3a3);
		border-radius: 999px;
		padding: 0.35rem 0.9rem;
		font-size: 0.85rem;
		cursor: pointer;
		font-family: inherit;
	}
	.mode-btn.active {
		background: var(--text, #f5f5f5);
		color: #0d0d0d;
		border-color: var(--text, #f5f5f5);
		font-weight: 600;
	}

	.component-block {
		background: var(--bg-input, #131313);
		border: 1px solid var(--border, #232323);
		border-radius: 12px;
		padding: 1rem 1.1rem;
		margin-bottom: 0.9rem;
	}

	.comp-top {
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 1.5rem;
		margin-bottom: 0.75rem;
	}

	.comp-top-left {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.weightage-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	/* .order-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	} */

	.select.order-select {
		min-width: 64px;
		width: 64px;
		padding: 0.55rem 0.5rem;
	}

	.name-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.name-input {
		background: var(--bg-hover, #171717);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 10px;
		padding: 0.55rem 0.7rem;
		color: var(--text, #f5f5f5);
		font-size: 0.9rem;
		width: 160px;
		font-family: inherit;
	}
	.name-input:focus {
		outline: none;
		border-color: var(--border-hover, #525252);
	}
	.best-of-row .mini-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.field-label {
		font-family: var(--font-mono, monospace);
		font-size: 0.72rem;
		letter-spacing: 0.03em;
		color: #f5f5f5;
	}

	.select {
		background: var(--bg-hover, #171717);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 10px;
		padding: 0.55rem 0.7rem;
		color: var(--text, #f5f5f5);
		font-size: 0.9rem;
		min-width: 180px;
		font-family: inherit;
	}
	.select:focus,
	.mini-input:focus {
		outline: none;
		border-color: var(--border-hover, #525252);
	}

	.future-checkbox {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono, monospace);
		font-size: 0.78rem;
		color: var(--text-secondary, #d1d5db);
		cursor: pointer;
		margin-left: auto;
		padding-bottom: 0.35rem;
	}
	.future-checkbox input {
		width: 15px;
		height: 15px;
		accent-color: #60a5fa;
	}

	.best-of-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.85rem;
		font-family: var(--font-mono, monospace);
	}
	.best-of-row .field-label {
		font-family: var(--font-mono, monospace);
	}

	.mini-input {
		background: var(--bg-hover, #171717);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 8px;
		padding: 0.4rem 0.5rem;
		color: var(--text, #f5f5f5);
		width: 55px;
		font-size: 0.85rem;
		font-family: inherit;
	}

		.mini-input.invalid,
	.mini-input.invalid:focus {
		border-color: #ef4444;
	}

	.field-error {
		color: #f87171;
		font-size: 0.78rem;
		margin: 0.1rem 0 0.4rem;
	}
	.marks-error {
		padding-left: calc(110px + 1.25rem);
		margin: -0.15rem 0 0.2rem;
	}
	.best-error {
		margin: -0.45rem 0 0.85rem;
	}
	.target-error {
		margin: -1rem 0 1.25rem;
	}

	/* .note {
		color: #fbbf24;
		font-size: 0.8rem;
		background: #1a1608;
		border: 1px solid #3a2f0d;
		border-radius: 8px;
		padding: 0.55rem 0.8rem;
		margin: 0;
	} */

	.future-note {
		color: var(--text-muted, #6b7280);
		font-size: 0.82rem;
		font-style: italic;
		margin: 0;
	}

	.marks-table {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.marks-header {
		display: grid;
		grid-template-columns: 110px 1fr 64px;
		gap: 1.25rem;
		font-family: var(--font-mono, monospace);
		font-size: 0.7rem;
		letter-spacing: 0.03em;
		color: #f5f5f5;
		padding: 0 0.1rem;
	}
	.marks-table.with-avg .marks-header {
		grid-template-columns: 110px 1fr 1fr 64px;
	}

	.marks-row {
		display: grid;
		grid-template-columns: 110px 1fr 64px;
		gap: 1.25rem;
		align-items: center;
	}
	.marks-table.with-avg .marks-row {
		grid-template-columns: 110px 1fr 1fr 64px;
	}

	.marks-label {
		font-size: 0.85rem;
		color: var(--text-secondary, #d1d5db);
	}

	.marks-input {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.slash {
		color: var(--text-muted, #6b7280);
	}

	.add-btn {
		background: transparent;
		border: 1px dashed var(--border, #3f3f3f);
		color: var(--text-secondary, #d1d5db);
		border-radius: 10px;
		padding: 0.55rem 1rem;
		font-size: 0.85rem;
		cursor: pointer;
		margin-top: 0.3rem;
		margin-bottom: 1rem;
		font-family: inherit;
	}
	.add-btn:hover {
		border-color: var(--border-hover, #737373);
		color: var(--text, #ffffff);
	}

	.weight-warning {
		color: #f5f5f5;
		font-size: 0.8rem;
		margin: -0.4rem 0 1rem;
		padding: 0 1.1rem;
	}

	.weight-warning.over {
		color: #f87171;
	}

	.totals {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}
	.total-box {
		background: var(--bg-input, #171717);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 10px;
		padding: 0.75rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 160px;
	}
	.total-label {
		font-family: var(--font-mono, monospace);
		font-size: 0.7rem;
		color: #f5f5f5;
		letter-spacing: 0.03em;
	}
	.total-value {
		font-size: 1.4rem;
		font-weight: 700;
	}
	.total-value.student {
		color: #f5f5f5;
	}
	.total-value.class-avg {
		color: #f5f5f5;
	}
	.target-hint {
		margin: 0.35rem 0 0;
		max-width: 26ch;
		font-family: var(--font-mono, monospace);
		font-size: 0.7rem;
		line-height: 1.45;
		color: var(--text-muted, #9ca3af);
	}
	.target-hint strong {
		color: var(--text, #f5f5f5);
		font-weight: 600;
	}
	.target-field {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
	}

	.progress-section {
		border-top: 1px solid var(--border, #262626);
		padding: 1.25rem 1.1rem 0;
		margin-top: 0.25rem;
	}
	.progress-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text, #f5f5f5);
		margin: 0 0 1rem;
	}

	@media (max-width: 640px) {
		.course-card {
			padding: 1.1rem;
		}
		.course-name-input {
			flex: 1 1 0;
		}
		.mode-toggle {
			flex-wrap: wrap;
		}
		.comp-top {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}
		.comp-top-left,
		.weightage-field,
		.name-field {
			width: 100%;
		}
		.name-input {
			width: 100%;
			box-sizing: border-box;
		}
		.select {
			min-width: 0;
			width: 100%;
		}
		.order-select {
			width: 100%;
		}
		.future-checkbox {
			margin-left: 0;
		}
		.best-of-row {
			flex-wrap: wrap;
			row-gap: 0.5rem;
		}
		.marks-header,
		.marks-row,
		.marks-table.with-avg .marks-header,
		.marks-table.with-avg .marks-row {
			grid-template-columns: 1fr;
			gap: 0.4rem;
		}
		.marks-input {
			flex-wrap: wrap;
		}
		.mini-input {
			width: 100%;
			min-width: 0;
			max-width: 90px;
		}
		.totals {
			flex-direction: column;
		}
		.total-box {
			min-width: 0;
			width: 100%;
			box-sizing: border-box;
		}
		.target-field{
			margin-left: 0;
		}
		.marks-error {
			padding-left: 0;
		}
	}
</style>