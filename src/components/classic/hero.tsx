"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";

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

/**
 * Classic-mode hero. Left-aligned split composition: type on the left,
 * a drifting accent glow and blueprint grid carrying the right side.
 */
export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden">
      {/* Background: blueprint grid fading toward the left + drifting glow */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_80%_70%_at_70%_45%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--wall-grid) 1px, transparent 1px), linear-gradient(90deg, var(--wall-grid) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="animate-glow-drift absolute right-[-10%] top-[12%] h-[34rem] w-[34rem] rounded-full bg-accent/15 blur-[120px]" />
      </div>

      <motion.div
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6"
      >
        <div className="max-w-2xl">
          <motion.h1
            variants={item}
            className="text-5xl font-semibold leading-none tracking-tighter sm:text-6xl lg:text-7xl"
          >
            {site.name}
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-4 font-mono text-base text-accent sm:text-lg"
          >
            {site.role}
          </motion.p>

          <motion.p
            variants={item}
            className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted-foreground"
          >
            {site.tagline}
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
        </div>
      </motion.div>
    </section>
  );
}
