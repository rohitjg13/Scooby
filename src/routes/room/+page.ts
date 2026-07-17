import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// /room is a short alias for /room-switch. 302 (not 301) so the alias isn't
// cached permanently by browsers if the canonical URL ever changes.
export const load: PageLoad = () => {
	redirect(302, "/room-switch");
};
