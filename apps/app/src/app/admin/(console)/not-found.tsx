import { SearchX } from "lucide-react";
import { getAdminLocale } from "@/lib/admin/locale";
import { t } from "@/lib/admin/i18n";
import { BtnLink } from "../_ui/Button";

/**
 * notFound() from a console page (an unknown or deleted family, a plan that is
 * not theirs) lands here, inside the frame — the app's root 404 is the
 * customer-facing page and would send an operator to the customer dashboard.
 */
export default async function ConsoleNotFound() {
  const locale = await getAdminLocale();
  return (
    <div className="ad-error">
      <div className="ad-error-card">
        <span className="ad-error-ic ad-neutral" aria-hidden="true">
          <SearchX className="ad-ic" />
        </span>
        <h1>{t("sh_not_found_title", locale)}</h1>
        <p>{t("sh_not_found_body", locale)}</p>
        <div className="ad-row">
          <BtnLink href="/admin/families" variant="primary">
            {t("sh_back_families", locale)}
          </BtnLink>
          <BtnLink href="/admin" variant="secondary">
            {t("sh_back_overview", locale)}
          </BtnLink>
        </div>
      </div>
    </div>
  );
}
