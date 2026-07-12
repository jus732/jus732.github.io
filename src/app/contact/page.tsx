import type { Metadata } from "next";

import { SiteChrome, PageHeader } from "@/components/classic/site-chrome";
import { ContactContent } from "@/components/content/contact-content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch about roles, consulting, or developer tooling.",
  openGraph: {
    title: "Contact",
    description: "Get in touch about roles, consulting, or developer tooling.",
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <SiteChrome>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <PageHeader
          title="Contact"
          lede="The inbox is open. Tell me what you are working on and where I can help."
        />
        <div className="mt-12">
          <ContactContent />
        </div>
      </section>
    </SiteChrome>
  );
}
