import { Logo } from "@/components/Logo";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata = {
  title: "كلمة مرور جديدة",
  robots: { index: false, follow: false },
};

/**
 * Where the password-recovery link lands, after /auth/callback has exchanged
 * the code for a session. Supabase treats that session as sufficient to call
 * updateUser({ password }), so the form needs no old password — but it does
 * need a live session, which is why this sits behind the proxy's auth gate
 * rather than being public.
 */
export default function UpdatePasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo priority className="h-20 w-auto mx-auto" />
        </div>
        <div className="bg-white rounded-3xl border border-brand-ink/5 shadow-xl p-8">
          <UpdatePasswordForm />
        </div>
      </div>
    </main>
  );
}
