import { useEffect } from "react";
import { Link } from "wouter";
import { Streamdown } from "streamdown";
import PortfolioKittySvg from "@/components/PortfolioKittySvg";
import policyMarkdown from "@/content/ekitty-privacy-policy.md?raw";

export default function PrivacyPolicy() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Privacy · ekitty";
    return () => { document.title = previous; };
  }, []);

  return (
    <main className="min-h-[100dvh] bg-white text-stone-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2 rounded-md font-serif text-lg outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]">
            <PortfolioKittySvg stroke="#c52222" fill="transparent" fillOpacity={0} strokeWidth={2.5} className="h-9 w-9" />
            ekitty
          </Link>
          <Link href="/" className="rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-[.14em] text-stone-500 outline-none transition hover:text-stone-900 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]">
            Back to the field
          </Link>
        </div>
      </header>
      <article className="mx-auto w-full max-w-3xl px-5 pb-20 pt-10">
        <Streamdown className="privacy-markdown" controls={false} isAnimating={false}>{policyMarkdown}</Streamdown>
      </article>
    </main>
  );
}
