"use client";

import { skills, bio, philosophy, site } from "@/lib/site";
import { Reveal } from "@/components/ui/motion/reveal";

/**
 * About section shared by the classic /about page and the desktop About
 * window. Bio and philosophy on the left, experience callout and skills
 * on the right; collapses to a single column on narrow surfaces.
 */
export function AboutContent() {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-10 @3xl:grid-cols-[3fr_2fr] @3xl:gap-14">
        {/* Bio + philosophy */}
        <div className="space-y-6">
          <Reveal>
            <div className="max-w-[65ch] space-y-4">
              {bio.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <figure className="border-l-2 border-accent pl-5">
              <blockquote className="text-lg font-medium leading-relaxed tracking-tight">
                {philosophy}
              </blockquote>
              <figcaption className="mt-2 text-sm text-muted-foreground">
                How I think about engineering
              </figcaption>
            </figure>
          </Reveal>
        </div>

        {/* Experience callout + skills */}
        <div className="space-y-8">
          <Reveal delay={0.05}>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-5xl font-semibold tracking-tight text-accent">
                  {site.yearsOfExperience}
                </span>
                <span className="text-lg text-muted-foreground">years</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                solving hard problems, creating fast feedback loops, and leaving code that the next person can read.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="space-y-5">
              {skills.map((group) => (
                <div key={group.category}>
                  <h3 className="mb-2 text-sm font-semibold">{group.category}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                    {group.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-lg border border-border px-2.5 py-0.5 transition-colors hover:border-accent/50 hover:text-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
