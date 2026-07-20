"use client";

import * as React from "react";
import { Check, Loader2, Trash2 } from "lucide-react";

const STORAGE_KEY = "portfolio-notepad";
const SAVE_DEBOUNCE_MS = 600;

/**
 * Notepad: a plain text editor that autosaves to localStorage.
 * Content survives closing the window and reloading the page.
 */
export function NotepadApp() {
  const [text, setText] = React.useState(
    () => window.localStorage.getItem(STORAGE_KEY) ?? ""
  );
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, text);
      setDirty(false);
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, dirty]);

  function clearAll() {
    setText("");
    window.localStorage.removeItem(STORAGE_KEY);
    setDirty(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <span
          role="status"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {dirty ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Saving
            </>
          ) : (
            <>
              <Check className="size-3 text-accent" />
              Saved to this browser
            </>
          )}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {text.length} characters
        </span>
        <button
          onClick={clearAll}
          aria-label="Clear note"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        placeholder="Type something. It saves itself."
        aria-label="Notepad content"
        spellCheck={false}
        className="flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}
