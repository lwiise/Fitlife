import { Database } from "lucide-react";
import { ExportButton } from "./ExportButton";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { Card, CardHeader } from "@/components/ui/card";
import { genderPick } from "@/lib/copy/gender";

export function DataSection({
  userEmail,
  ownerSex,
}: {
  userEmail: string;
  ownerSex?: string | null;
}) {
  const g = genderPick(ownerSex);
  return (
    <Card aria-labelledby="data-section-title">
      <CardHeader
        id="data-section-title"
        className="mb-4"
        title="بياناتك"
        icon={<Database className="size-5 text-brand-purple-900" aria-hidden="true" />}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <ExportButton ownerSex={ownerSex} />
          <p className="mt-2 text-meta leading-relaxed text-brand-ink-muted">
            {g("احصلي على نسخة من بياناتك بصيغة JSON.", "احصل على نسخة من بياناتك بصيغة JSON.")}
          </p>
        </div>
        <div>
          <DeleteAccountButton userEmail={userEmail} ownerSex={ownerSex} />
          <p className="mt-2 text-meta leading-relaxed text-brand-ink-muted">
            حذف حسابك وكل بياناتك بشكل نهائي، ولا يمكن التراجع عن ذلك.
          </p>
        </div>
      </div>
    </Card>
  );
}
