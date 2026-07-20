"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import {
  Caret,
  FrameSection,
  TypedLine,
  WindowFrame,
  useTypedLines,
} from "@/components/classic/page-frame";

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

const HERO_TITLE = "justin — ~/portfolio";

/** Typed in order: title bar, then role, then tagline. */
const HERO_LINES: readonly string[] = [HERO_TITLE, site.role, site.tagline];

/**
 * Classic-mode hero. The type block sits inside the shared app-window
 * chrome (FrameSection backdrop + WindowFrame shell from page-frame.tsx)
 * with one typewriter sequence running from the title bar through the role
 * and tagline, ending on the blinking caret.
 */
export function Hero() {
  const reduce = useReducedMotion();
  const typed = useTypedLines(HERO_LINES, { startDelay: 550 });

  return (
    <FrameSection className="flex min-h-[100dvh] items-center">
      <motion.div
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6"
      >
        <motion.div variants={item}>
          <WindowFrame
            title={HERO_TITLE}
            className="max-w-2xl"
            typedTitle={{
              typed: typed.text(0),
              caret: typed.activeLine === 0 && <Caret blinking={false} />,
            }}
          >
            <motion.h1
              variants={item}
              className="text-4xl font-semibold leading-none tracking-tighter sm:text-5xl lg:text-6xl"
            >
              {site.name}
            </motion.h1>

            <motion.p
              variants={item}
              className="relative mt-4 font-mono text-base text-accent sm:text-lg"
            >
              <TypedLine
                text={site.role}
                typed={typed.text(1)}
                caret={typed.activeLine === 1 && <Caret blinking={false} />}
              />
            </motion.p>

            <motion.p
              variants={item}
              className="relative mt-5 max-w-[46ch] text-lg leading-relaxed text-muted-foreground"
            >
              <TypedLine
                text={site.tagline}
                typed={typed.text(2)}
                caret={
                  (typed.activeLine === 2 || typed.done) && <Caret blinking={typed.done} />
                }
              />
            </motion.p>

            <motion.div variants={item} className="mt-9 flex flex-wrap items-center gap-3">
              {/* TODO: reveal projects when ready */}
              {/*<Button asChild size="lg">*/}
              {/*  <Link href="/projects">*/}
              {/*    View Projects*/}
              {/*    <ArrowRight />*/}
              {/*  </Link>*/}
              {/*</Button>*/}
              <Button asChild size="lg">
                <Link href="/about">
                  About Me
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Get in Touch</Link>
              </Button>
            </motion.div>
          </WindowFrame>
        </motion.div>
      </motion.div>
    </FrameSection>
  );
}
