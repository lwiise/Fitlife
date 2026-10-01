/**
 * Insights is temporarily hidden from the admin console. The page and all of
 * its data and components are left intact; this one flag hides it: the page
 * (app/admin/(console)/insights) redirects to the overview, and the rail
 * shows Insights dimmed with a «مخفية» tag instead of linking to it. Set it to
 * `false` to bring Insights back — page and rail entry together.
 */
export const INSIGHTS_HIDDEN: boolean = true;
