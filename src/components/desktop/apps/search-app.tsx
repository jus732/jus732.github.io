"use client";

import * as React from "react";
import { SearchX } from "lucide-react";

import { apps } from "@/components/desktop/apps";
import { useWindows } from "@/components/desktop/window/window-manager";
import { Input } from "@/components/ui/input";

/**
 * Search window: filters every launchable section and app by name or
 * description. Enter opens the top result; clicking a row opens it too.
 */
export function SearchApp() {
  const { open } = useWindows();
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const results = apps.filter(
    (app) =>
      app.id !== "search" &&
      (q === "" ||
        app.title.toLowerCase().includes(q) ||
        app.blurb.toLowerCase().includes(q))
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && results.length > 0) {
      open(results[0].id);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search sections and apps"
        aria-label="Search sections and apps"
      />

      {results.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <SearchX className="size-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            Nothing matches &ldquo;{query}&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="-mx-1 flex-1 overflow-y-auto">
          {results.map((app) => (
            <li key={app.id}>
              <button
                onClick={() => open(app.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <app.icon className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">
                    {app.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {app.blurb}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
