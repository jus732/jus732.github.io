import type { Metadata } from "next";

import { SiteChrome, PageHeader } from "@/components/classic/site-chrome";
import { FrameSection, WindowFrame } from "@/components/classic/page-frame";
import { ContactForm, ContactInfo } from "@/components/content/contact-content";

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
      <FrameSection>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          {/* Two columns on wide screens; the right column starts a
              title-bar's height lower for an intentional stagger. */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
            <PageHeader
              title="Contact"
              lede="The inbox is open. Tell me what you are working on and where I can help."
              className="max-w-2xl lg:max-w-none"
            >
              <ContactInfo />
            </PageHeader>
            <div className="max-w-2xl lg:mt-10 lg:max-w-none">
              <WindowFrame title="justin — ~/message" typeDelay={1000}>
                <div className="@container">
                  <ContactForm />
                </div>
              </WindowFrame>
            </div>
          </div>
        </div>
      </FrameSection>
    </SiteChrome>
  );
}
