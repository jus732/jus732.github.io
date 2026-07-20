import { Navbar } from "@/components/classic/navbar";
import { Footer } from "@/components/classic/footer";

// PageHeader lives in page-frame.tsx (it drives the typewriter, so it's a
// client component); re-exported here so pages keep one chrome import.
export { PageHeader } from "@/components/classic/page-frame";

/** Classic-mode page frame: fixed navbar, content, footer. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="pt-16">{children}</main>
      <Footer />
    </>
  );
}
