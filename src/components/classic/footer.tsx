import { Mail } from "lucide-react";

import { site } from "@/lib/site";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand";

/** Minimal footer for classic mode. */
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <p className="text-sm text-muted-foreground">
          {new Date().getFullYear()} {site.name}. Built with Next.js.
        </p>
        <div className="flex items-center gap-1">
          <a
            href={`mailto:${site.email}`}
            aria-label="Email"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
          >
            <Mail className="size-4" />
          </a>
          <a
            href={site.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
          >
            <GithubIcon />
          </a>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
          >
            <LinkedinIcon />
          </a>
        </div>
      </div>
    </footer>
  );
}
