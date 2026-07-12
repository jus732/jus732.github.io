import type { Metadata } from "next";

import { SiteChrome, PageHeader } from "@/components/classic/site-chrome";
import { AboutContent } from "@/components/content/about-content";

export const metadata: Metadata = {
  title: "About",
  description:
    "Software engineer focused on performance, observability, and making complex systems feel simple.",
  openGraph: {
    title: "About",
    description:
      "Software engineer focused on performance, observability, and making complex systems feel simple.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <SiteChrome>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <PageHeader
          title="About"
          lede=""
        />
        <div className="mt-12">
          <AboutContent />
        </div>
      </section>
    </SiteChrome>
  );
}
