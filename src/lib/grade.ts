// src/lib/grade.ts

export type GradingMode = 'relative' | 'absolute';

export type ComponentType =
	| 'Midsem'
	| 'Endsem'
	| 'Class Participation'
	| 'Quiz'
	| 'Assignment'
	| 'Graded Lab'
	| 'Lab Assignments'
	| 'Project'
	| 'Presentation'
	| 'Other';

export const COMPONENT_TYPES: ComponentType[] = [
	'Midsem',
	'Endsem',
	'Class Participation',
	'Quiz',
	'Assignment',
	'Graded Lab',
	'Lab Assignments',
	'Project',
	'Presentation',
	'Other'
];

export const BEST_OF_TYPES: ComponentType[] = [
	'Quiz',
	'Assignment',
	'Graded Lab',
	'Lab Assignments',
	'Other'
];

export function needsBestOf(type: ComponentType): boolean {
	return true;
}

export interface MarksIteration {
	id: string;
	studentObtained: number;
	studentTotal: number;
	classAvgObtained: number;
	classAvgTotal: number;
	order?: number;
}

export interface GradedComponent {
	id: string;
	type: ComponentType;
	weightage: number;
	bestOfCount: number | null;
	bestOfTotal: number | null;
	iterations: MarksIteration[];
	isFuture: boolean;
	/** 1-based chronological position of this component, set by the student via the order dropdown. */
	order: number;
	/** User-given name, only used when type is 'Other'. */
	customName?: string;
}

export interface Course {
	id: string;
	name: string;
	mode: GradingMode;
	components: GradedComponent[];
	/** The percentage the student is aiming for in this course. */
	targetPct: number;
}

export function createEmptyIteration(id: string): MarksIteration {
	return {
		id,
		studentObtained: 0,
		studentTotal: 100,
		classAvgObtained: 0,
		classAvgTotal: 100
	};
}

export function createEmptyComponent(id: string): GradedComponent {
	return {
		id,
		type: 'Midsem',
		weightage: 0,
		bestOfCount: 1,
		bestOfTotal: 1,
		iterations: [createEmptyIteration(`${id}-iter-1`)],
		isFuture: false,
		order: 1
	};
}

/** Display name: the custom name for 'Other' components, else the type. */
export function componentName(comp: Pick<GradedComponent, 'type' | 'customName'>): string {
	return (comp.type === 'Other' && comp.customName?.trim()) || comp.type;
}

const SINGULAR_OVERRIDES: Record<string, string> = {
	'Lab Assignments': 'Lab Assignment'
};

export function attemptLabel(type: string, index: number): string {
	const base = SINGULAR_OVERRIDES[type] ?? type;
	return `${base.toLowerCase()} ${index}`;
}

export function createEmptyCourse(id: string): Course {
	return {
		id,
		name: '',
		mode: 'relative',
		components: [],
		targetPct: 0
	};
}

export function requiredIterationCount(comp: Pick<GradedComponent, 'type' | 'bestOfTotal'>): number {
	if (!needsBestOf(comp.type)) return 1;
	if (!comp.bestOfTotal || comp.bestOfTotal < 1) return 1;
	return comp.bestOfTotal;
}

export function syncComponentIterations(
	comp: GradedComponent,
	makeId: () => string
): GradedComponent {
	const required = requiredIterationCount(comp);
	let iterations = comp.iterations;

	if (iterations.length < required) {
		const toAdd = required - iterations.length;
		const additions = Array.from({ length: toAdd }, () => createEmptyIteration(makeId()));
		iterations = [...iterations, ...additions];
	} else if (iterations.length > required) {
		iterations = iterations.slice(0, required);
	}

	return { ...comp, iterations };
}

export function resetToSingleIteration(comp: GradedComponent): GradedComponent {
	return {
		...comp,
		bestOfCount: null,
		bestOfTotal: null,
		iterations: comp.iterations.slice(0, 1)
	};
}

/**
 * Reassigns `order` across all components to a clean 1..N sequence based on
 * each component's current relative order. Use after removing a component so
 * the remaining dropdown values stay contiguous.
 */
export function renumberOrders(components: GradedComponent[]): GradedComponent[] {
	const sorted = [...components].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	const positionById = new Map(sorted.map((c, i) => [c.id, i + 1]));
	return components.map((c) => ({ ...c, order: positionById.get(c.id) ?? c.order }));
}

/**
 * Sets one component's order to `newOrder`, swapping with whichever other
 * component currently holds that slot so the set of orders stays a valid
 * 1..N permutation instead of ending up with duplicates.
 */
export function setComponentOrder(
	components: GradedComponent[],
	id: string,
	newOrder: number
): GradedComponent[] {
	const target = components.find((c) => c.id === id);
	if (!target) return components;
	const oldOrder = target.order;
	if (newOrder === oldOrder) return components;

	return components.map((c) => {
		if (c.id === id) return { ...c, order: newOrder };
		if (c.order === newOrder) return { ...c, order: oldOrder };
		return c;
	});
}

/**
 * Gives every mark entry in non-future components a clean 1..N order.
 * - Entries with no order yet (newly added, or saved before this feature) go to the end,
 *   except when nothing has an order at all (old saved data), in which case the old
 *   component-level order is used as the starting point.
 * - Entries in future components have their order cleared, so they land at the end
 *   once the component is no longer future.
 */
export function normalizeIterationOrders(components: GradedComponent[]): GradedComponent[] {
	const anyOrdered = components.some(
		(c) => !c.isFuture && c.iterations.some((it) => typeof it.order === 'number')
	);

	const entries: { iterId: string; key: number; seq: number }[] = [];
	components.forEach((c, ci) => {
		if (c.isFuture) return;
		c.iterations.forEach((it, ii) => {
			const key =
				typeof it.order === 'number'
					? it.order
					: anyOrdered
						? Number.MAX_SAFE_INTEGER
						: (c.order ?? ci + 1) * 1000 + ii;
			entries.push({ iterId: it.id, key, seq: entries.length });
		});
	});

	entries.sort((a, b) => a.key - b.key || a.seq - b.seq);
	const position = new Map(entries.map((e, i) => [e.iterId, i + 1]));

	return components.map((c) => ({
		...c,
		iterations: c.iterations.map((it) => ({ ...it, order: position.get(it.id) }))
	}));
}

/** Sets one mark entry's order, swapping with whichever entry held that slot. */
export function setIterationOrder(
	components: GradedComponent[],
	iterationId: string,
	newOrder: number
): GradedComponent[] {
	let oldOrder: number | undefined;
	for (const c of components) {
		if (c.isFuture) continue;
		const it = c.iterations.find((i) => i.id === iterationId);
		if (it) oldOrder = it.order;
	}
	if (oldOrder === undefined || oldOrder === newOrder) return components;

	return components.map((c) => {
		if (c.isFuture) return c;
		return {
			...c,
			iterations: c.iterations.map((it) => {
				if (it.id === iterationId) return { ...it, order: newOrder };
				if (it.order === newOrder) return { ...it, order: oldOrder };
				return it;
			})
		};
	});
}