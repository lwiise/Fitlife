import ReactMarkdown, { type Components } from "react-markdown";

// Brand-styled, RTL-correct mapping for long-form Arabic legal content.
// No typography plugin — full control over Tajawal weights, spacing, contrast.
const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="font-extrabold text-2xl md:text-3xl text-brand-ink leading-tight mb-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-bold text-xl md:text-2xl text-brand-ink leading-snug mt-10 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-bold text-lg text-brand-ink mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-brand-ink text-base leading-loose mb-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc ps-6 mb-4 space-y-1.5 text-brand-ink leading-relaxed">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ps-6 mb-4 space-y-1.5 text-brand-ink leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-brand-purple-900 underline underline-offset-4 hover:text-brand-purple-700 transition-colors"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-brand-ink">{children}</strong>
  ),
  hr: () => <hr className="my-8 border-brand-ink/10" />,
};

export function MarkdownContent({ children }: { children: string }) {
  return <ReactMarkdown components={COMPONENTS}>{children}</ReactMarkdown>;
}
