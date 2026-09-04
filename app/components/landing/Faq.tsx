import { faqItems } from "@/lib/seo/jsonld";
import { Reveal } from "./Reveal";

// Server-rendered Q&A: the questions and answers must stay in the initial HTML
// (and mirror faqJsonLd exactly) so answer engines can extract them.
export function Faq() {
  return (
    <section id="faq" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            Everything people ask before their first scan.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {faqItems.map((item, i) => (
            <Reveal key={item.question} delay={(i % 2) * 0.1}>
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <h3 className="text-base font-semibold text-foreground">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
