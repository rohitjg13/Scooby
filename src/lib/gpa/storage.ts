import type { GpaState } from './types.ts';

const STORAGE_KEY = 'scooby:gpa-calculator:v1';

export function loadState(): GpaState | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as GpaState) : null;
	} catch {
		return null;
	}
}

export function saveState(state: GpaState): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// storage full or unavailable — fail silently, don't block the UI
	}
}

export function clearState(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(STORAGE_KEY);
}