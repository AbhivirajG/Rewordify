import Link from "next/link";
import { PricingPlansSection } from "@/components/PricingPlansSection";

export default function PricingPage() {
  return (
    <main className="max-w-5xl mx-auto px-8 py-16 w-full">
      <section className="mb-24">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-primary font-code-sm text-code-sm">$</span>
          <span className="font-code-sm text-code-sm text-outline-variant">
            cat pricing_plans.md
          </span>
          <span className="w-2 h-5 bg-primary cursor-blink inline-block" />
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-6">
          Choose your terminal access level.
        </h1>
        <p className="font-body-lg text-body-lg text-outline max-w-2xl">
          REWORDIFY provides technical precision for AI detection. Select the
          tier that matches your scanning velocity and integration needs.
        </p>
      </section>

      <PricingPlansSection />

      <section className="mb-24">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-8">
          Technical specifications
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-left py-4 font-label-caps text-label-caps text-outline">
                  Feature
                </th>
                <th className="text-center py-4 font-label-caps text-label-caps text-outline">
                  Free
                </th>
                <th className="text-center py-4 font-label-caps text-label-caps text-primary">
                  Pro
                </th>
                <th className="text-center py-4 font-label-caps text-label-caps text-outline">
                  Max
                </th>
              </tr>
            </thead>
            <tbody className="font-code-sm text-code-sm">
              <tr className="border-b border-neutral-900">
                <td className="py-4 text-on-surface">Essays / Month</td>
                <td className="text-center text-outline">1</td>
                <td className="text-center text-primary">∞</td>
                <td className="text-center text-outline">∞</td>
              </tr>
              <tr className="border-b border-neutral-900">
                <td className="py-4 text-on-surface">Max Word Count / Scan</td>
                <td className="text-center text-outline">1,000</td>
                <td className="text-center text-primary">10,000</td>
                <td className="text-center text-outline">25,000</td>
              </tr>
              <tr className="border-b border-neutral-900">
                <td className="py-4 text-on-surface">API Rate Limit</td>
                <td className="text-center text-outline-variant">N/A</td>
                <td className="text-center text-primary">60/min</td>
                <td className="text-center text-outline">120/min</td>
              </tr>
              <tr className="border-b border-neutral-900">
                <td className="py-4 text-on-surface">Detailed Metrics</td>
                <td className="text-center text-outline-variant">Basic</td>
                <td className="text-center text-primary">Full</td>
                <td className="text-center text-outline">Full + Export</td>
              </tr>
              <tr className="border-b border-neutral-900">
                <td className="py-4 text-on-surface">Humanizer Access</td>
                <td className="text-center text-outline-variant">1 essay</td>
                <td className="text-center text-primary">Unlimited</td>
                <td className="text-center text-outline">Priority queue</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="terminal-box p-12 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#ffd341 1px, transparent 1px), linear-gradient(90deg, #ffd341 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <h2 className="font-headline-md text-headline-md text-on-surface mb-6 relative z-10">
          Ready to secure your content?
        </h2>
        <p className="font-body-md text-body-md text-outline mb-8 max-w-xl mx-auto relative z-10">
          Join over 10,000+ developers and editors using REWORDIFY for precise
          linguistic analysis.
        </p>
        <div className="flex justify-center gap-4 relative z-10 flex-wrap">
          <Link
            href="/"
            className="bg-primary px-8 py-4 font-label-caps text-label-caps text-on-primary hover:opacity-90 transition-opacity"
          >
            GET_STARTED_NOW
          </Link>
          <button className="border border-outline-variant px-8 py-4 font-label-caps text-label-caps text-on-surface hover:bg-surface-container-high transition-colors">
            VIEW_DOCS
          </button>
        </div>
      </section>
    </main>
  );
}
