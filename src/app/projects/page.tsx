import type { Metadata } from "next";

import { SiteChrome, PageHeader } from "@/components/classic/site-chrome";
import { ProjectsGrid } from "@/components/content/projects-grid";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Selected work: reconciliation engines, CI tooling, feature flags, and more.",
  openGraph: {
    title: "Projects",
    description:
      "Selected work: reconciliation engines, CI tooling, feature flags, and more.",
    url: "/projects",
  },
};

export default function ProjectsPage() {
  return (
    <SiteChrome>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <PageHeader
          title="Projects"
          lede="A few things I have designed, built, and kept running in production. Every card links to a live demo and the source."
        />
        <div className="mt-12">
          <ProjectsGrid />
        </div>
      </section>
    </SiteChrome>
  );
}
