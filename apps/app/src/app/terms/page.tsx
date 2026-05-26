import { Logo } from "@/components/Logo";
import { MarkdownContent } from "@/components/MarkdownContent";
import { TERMS_MD } from "./content";

export const metadata = {
  title: "شروط الاستخدام — فت لايف",
  description: "شروط استخدام فت لايف: الخدمة، الاشتراك، القيود الطبية، والقانون المطبق.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <a
            href="/"
            aria-label="فت لايف — الرئيسية"
            className="inline-flex items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Logo className="h-9 w-auto" />
          </a>
          <a
            href="/auth/login"
            className="inline-flex items-center min-h-11 px-4 rounded-full text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            تسجيل الدخول
          </a>
        </div>
      </header>

      <article dir="rtl" className="container-app py-10 md:py-16 max-w-2xl">
        <MarkdownContent>{TERMS_MD}</MarkdownContent>
      </article>
    </main>
  );
}
