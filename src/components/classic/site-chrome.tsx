import { Navbar } from "@/components/classic/navbar";
import { Footer } from "@/components/classic/footer";

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

/** Consistent page header for the inner classic pages. */
export function PageHeader({ title, lede }: { title: string; lede: string }) {
  return (
    <header className="max-w-2xl">
      <h1 className="text-4xl font-semibold tracking-tighter sm:text-5xl">{title}</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">{lede}</p>
    </header>
  );
}
