"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Op = "+" | "-" | "*" | "/";

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return a / b;
  }
}

/** Trim floating-point noise (0.1 + 0.2 → 0.3) and overly long results. */
function format(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  return String(parseFloat(n.toPrecision(12)));
}

const OP_LABELS: Record<Op, string> = { "/": "÷", "*": "×", "-": "-", "+": "+" };

/** A standard immediate-execution calculator. */
export function CalculatorApp() {
  const [display, setDisplay] = React.useState("0");
  const [acc, setAcc] = React.useState<number | null>(null);
  const [op, setOp] = React.useState<Op | null>(null);
  // After an operator or equals, the next digit replaces the display.
  const [overwrite, setOverwrite] = React.useState(true);

  const errored = display === "Error";

  function inputDigit(d: string) {
    if (overwrite || errored) {
      setDisplay(d === "." ? "0." : d);
      setOverwrite(false);
      if (errored) {
        setAcc(null);
        setOp(null);
      }
      return;
    }
    if (d === "." && display.includes(".")) return;
    if (display.replace(/[-.]/g, "").length >= 12) return;
    setDisplay(display === "0" && d !== "." ? d : display + d);
  }

  function applyOp(next: Op) {
    if (errored) return;
    const current = parseFloat(display);
    if (acc !== null && op !== null && !overwrite) {
      const result = compute(acc, current, op);
      setAcc(Number.isFinite(result) ? result : null);
      setDisplay(format(result));
    } else {
      setAcc(current);
    }
    setOp(next);
    setOverwrite(true);
  }

  function equals() {
    if (errored || acc === null || op === null) return;
    const result = compute(acc, parseFloat(display), op);
    setDisplay(format(result));
    setAcc(null);
    setOp(null);
    setOverwrite(true);
  }

  function clear() {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setOverwrite(true);
  }

  function negate() {
    if (errored) return;
    setDisplay(format(-parseFloat(display)));
  }

  function percent() {
    if (errored) return;
    setDisplay(format(parseFloat(display) / 100));
    setOverwrite(true);
  }

  const keyBase =
    "flex h-12 items-center justify-center rounded-lg text-base font-medium transition-colors active:scale-[0.97]";
  const digitKey = cn(keyBase, "bg-muted hover:bg-border");
  const fnKey = cn(keyBase, "bg-muted/60 text-muted-foreground hover:bg-border");
  const opKey = (o: Op) =>
    cn(
      keyBase,
      op === o && overwrite
        ? "bg-accent text-accent-foreground"
        : "bg-accent/15 text-accent hover:bg-accent/25"
    );

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <output
        aria-label="Calculator result"
        className="flex min-h-16 items-end justify-end overflow-hidden rounded-lg bg-muted/40 px-4 py-3 font-mono text-3xl tracking-tight"
      >
        {display}
      </output>

      {/* Keys laid out in DOM order, row by row (C ± % ÷ / 789× / 456- / 123+ / 0.=) */}
      <div className="grid flex-1 grid-cols-4 content-start gap-2">
        <button className={fnKey} onClick={clear} aria-label="Clear">
          C
        </button>
        <button className={fnKey} onClick={negate} aria-label="Negate">
          +/-
        </button>
        <button className={fnKey} onClick={percent} aria-label="Percent">
          %
        </button>
        <button className={opKey("/")} onClick={() => applyOp("/")} aria-label="Divide">
          ÷
        </button>

        {(
          [
            ["7", "8", "9", "*"],
            ["4", "5", "6", "-"],
            ["1", "2", "3", "+"],
          ] as const
        ).map(([a, b, c, o]) => (
          <React.Fragment key={o}>
            <button className={digitKey} onClick={() => inputDigit(a)}>
              {a}
            </button>
            <button className={digitKey} onClick={() => inputDigit(b)}>
              {b}
            </button>
            <button className={digitKey} onClick={() => inputDigit(c)}>
              {c}
            </button>
            <button className={opKey(o)} onClick={() => applyOp(o)} aria-label={OP_LABELS[o]}>
              {OP_LABELS[o]}
            </button>
          </React.Fragment>
        ))}

        <button className={cn(digitKey, "col-span-2")} onClick={() => inputDigit("0")}>
          0
        </button>
        <button className={digitKey} onClick={() => inputDigit(".")}>
          .
        </button>
        <button
          className={cn(keyBase, "bg-accent text-accent-foreground hover:brightness-110")}
          onClick={equals}
          aria-label="Equals"
        >
          =
        </button>
      </div>
    </div>
  );
}
