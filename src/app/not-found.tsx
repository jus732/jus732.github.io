import Link from "next/link";

/**
 * 404 styled as a friendly blue screen, a wink at the desktop mode.
 * Uses the accent token directly so it reads "blue screen" in both themes.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-accent px-6 text-accent-foreground">
      <div className="max-w-md">
        <p className="text-7xl font-semibold tracking-tighter">:(</p>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          This page ran into a problem.
        </h1>
        <p className="mt-3 leading-relaxed opacity-90">
          Error 404: the page you were looking for was moved, renamed, or never
          existed in the first place.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-lg bg-accent-foreground px-6 text-sm font-medium text-accent transition-transform active:scale-[0.98]"
        >
          Restart at home
        </Link>
      </div>
    </main>
  );
}
