import type { Metadata } from "next";

import { SiteChrome, PageHeader } from "@/components/classic/site-chrome";
import { FrameSection, WindowFrame } from "@/components/classic/page-frame";
import { AboutBio, AboutExperience, AboutSkills } from "@/components/content/about-content";

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
      <FrameSection>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          {/* Two columns on wide screens; the right column starts a
              title-bar's height lower for an intentional stagger. */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
            <PageHeader title="About" lede="" className="max-w-2xl lg:max-w-none">
              <AboutBio />
            </PageHeader>
            <div className="max-w-2xl space-y-8 lg:mt-10 lg:max-w-none">
              <WindowFrame title="justin — ~/experience" typeDelay={900}>
                <AboutExperience />
              </WindowFrame>
              <WindowFrame title="justin — ~/skills" typeDelay={1400}>
                <AboutSkills />
              </WindowFrame>
            </div>
          </div>
        </div>
      </FrameSection>
    </SiteChrome>
  );
}
