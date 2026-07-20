"use client";

import * as React from "react";
import { Mail, Send, CheckCircle2 } from "lucide-react";

import { GithubIcon, LinkedinIcon } from "@/components/ui/icons/brand";

import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Reveal } from "@/components/ui/motion/reveal";

const channels = [
  {
    label: "Email",
    value: site.email,
    href: `mailto:${site.email}`,
    icon: Mail,
  },
  {
    label: "GitHub",
    value: "github.com/jus732",
    href: site.github,
    icon: GithubIcon,
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/jus732",
    href: site.linkedin,
    icon: LinkedinIcon,
  },
];

type FormStatus = "idle" | "sending" | "sent";

/**
 * Placeholder message form, exported so the classic /contact page can give
 * it a window of its own. Uses @lg container queries, so hosts must provide
 * an @container ancestor.
 */
export function ContactForm() {
  const [status, setStatus] = React.useState<FormStatus>("idle");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Placeholder submit: no backend is wired up yet. Simulates a short send
    // so the loading and success states are real, then resets the fields.
    setStatus("sending");
    const form = event.currentTarget;
    window.setTimeout(() => {
      setStatus("sent");
      form.reset();
    }, 700);
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="surface-raised flex h-full min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-center"
      >
        <CheckCircle2 className="size-8 text-accent" />
        <p className="font-medium">Message noted.</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          This demo form does not send anywhere yet. Email is the reliable
          channel for now.
        </p>
        <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>
          Write another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="surface-raised space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-name" className="text-sm font-medium">
            Name
          </label>
          <Input id="contact-name" name="name" placeholder="Ada Lovelace" required />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="contact-message" className="text-sm font-medium">
          Message
        </label>
        <Textarea
          id="contact-message"
          name="message"
          placeholder="What are you building?"
          required
        />
      </div>
      <Button type="submit" disabled={status === "sending"} className="w-full @lg:w-auto">
        {status === "sending" ? "Sending" : "Send message"}
        <Send />
      </Button>
    </form>
  );
}

/** Channel list (email / GitHub / LinkedIn) with hover affordances. */
export function ContactInfo() {
  return (
    <Reveal>
      <div className="space-y-6">
        <ul className="space-y-1">
          {channels.map((channel) => (
            <li key={channel.label}>
              <a
                href={channel.href}
                target={channel.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-[background-color,transform] duration-200 hover:bg-muted motion-safe:hover:translate-x-0.5"
              >
                <channel.icon className="size-4 text-muted-foreground transition-colors group-hover:text-accent" />
                <span className="text-sm font-medium">{channel.label}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {channel.value}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

/**
 * Combined contact layout for the desktop Contact window: channel list and
 * message form side by side.
 */
export function ContactContent() {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-10 @3xl:grid-cols-[2fr_3fr] @3xl:gap-14">
        <ContactInfo />

        <Reveal delay={0.08}>
          <ContactForm />
        </Reveal>
      </div>
    </div>
  );
}
