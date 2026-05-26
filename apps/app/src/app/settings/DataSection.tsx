import { Database } from "lucide-react";
import { ExportButton } from "./ExportButton";
import { DeleteAccountButton } from "./DeleteAccountButton";

export function DataSection({ userEmail }: { userEmail: string }) {
  return (
    <section className="bg-white rounded-2xl border border-brand-ink/5 p-6 md:p-7">
      <div className="flex items-center gap-3 mb-5">
        <div className="size-10 rounded-full bg-brand-pink-light flex items-center justify-center flex-shrink-0">
          <Database className="size-5 text-brand-pink" aria-hidden="true" />
        </div>
        <h2 className="font-bold text-lg text-brand-ink">بياناتك</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <ExportButton />
          <p className="mt-2 text-brand-ink-muted text-xs leading-relaxed">
            احصلي على نسخة من بياناتك بصيغة JSON
          </p>
        </div>
        <div>
          <DeleteAccountButton userEmail={userEmail} />
          <p className="mt-2 text-brand-ink-muted text-xs leading-relaxed">
            حذف حسابك وكل بياناتك بشكل نهائي. لا يمكن التراجع
          </p>
        </div>
      </div>
    </section>
  );
}
