// Re-export with descriptive names to avoid naming collisions.
export { createClient as createBrowserClient } from "./client";
export { createClient as createServerClient } from "./server";
export { updateSession } from "./middleware";
