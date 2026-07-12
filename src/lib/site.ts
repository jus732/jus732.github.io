/**
 * Single source of truth for site content.
 * Everything below is placeholder copy. Swap in real details before launch.
 */

export const site = {
  name: "Justin Santiago",
  initials: "JS",
  role: "Software Engineer",
  tagline:
    "I build fast, resilient web platforms and the developer tools that keep them honest.",
  url: "https://justin-santiago.com",
  email: "jus732@gmail.com",
  github: "https://github.com/jus732",
  linkedin: "https://www.linkedin.com/in/jus732",
  location: "Jersey City, USA",
  yearsOfExperience: 6,
} as const;

export type Project = {
  slug: string;
  name: string;
  description: string;
  tech: string[];
  demoUrl: string;
  repoUrl: string;
  /** Seed for the picsum.photos placeholder thumbnail. */
  imageSeed: string;
};

// TODO: fill this out
export const projects: Project[] = [
  // {
  //   slug: "ledgerline",
  //   name: "Ledgerline",
  //   description:
  //     "Reconciliation engine that matches millions of payment events against ledger entries every night. Cut month-end close from four days to one afternoon.",
  //   tech: ["TypeScript", "PostgreSQL", "Temporal", "AWS"],
  //   demoUrl: "https://example.com/ledgerline",
  //   repoUrl: "https://github.com/jus732",
  //   imageSeed: "ledgerline-fintech-dashboard",
  // },
  // {
  //   slug: "corvid",
  //   name: "Corvid",
  //   description:
  //     "CI observability service that fingerprints flaky tests across thousands of pipeline runs. Surfaces the worst offenders before they erode trust in the build.",
  //   tech: ["Go", "ClickHouse", "React", "Kubernetes"],
  //   demoUrl: "https://example.com/corvid",
  //   repoUrl: "https://github.com/jus732",
  //   imageSeed: "corvid-ci-pipelines",
  // },
  // {
  //   slug: "waypoint",
  //   name: "Waypoint",
  //   description:
  //     "Feature flag platform with progressive rollouts and instant kill switches. Serves flag evaluations from the edge in under five milliseconds.",
  //   tech: ["Next.js", "Cloudflare Workers", "Redis", "tRPC"],
  //   demoUrl: "https://example.com/waypoint",
  //   repoUrl: "https://github.com/jus732",
  //   imageSeed: "waypoint-feature-flags",
  // },
  // {
  //   slug: "quillmark",
  //   name: "Quillmark",
  //   description:
  //     "Local-first markdown editor with CRDT sync across devices. Works fully offline and merges edits without conflicts when you reconnect.",
  //   tech: ["TypeScript", "Yjs", "Tauri", "SQLite"],
  //   demoUrl: "https://example.com/quillmark",
  //   repoUrl: "https://github.com/jus732",
  //   imageSeed: "quillmark-writing-desk",
  // },
  // {
  //   slug: "hearthstat",
  //   name: "Hearthstat",
  //   description:
  //     "Home energy monitor that streams smart meter data into live dashboards and nudges you when usage spikes. Runs happily on a shelf Raspberry Pi.",
  //   tech: ["React", "MQTT", "TimescaleDB", "Grafana"],
  //   demoUrl: "https://example.com/hearthstat",
  //   repoUrl: "https://github.com/jus732",
  //   imageSeed: "hearthstat-energy-home",
  // },
  // {
  //   slug: "ferrite",
  //   name: "Ferrite",
  //   description:
  //     "Terminal log viewer that tails, filters, and highlights gigabyte-scale files without breaking a sweat. Built for on-call engineers digging through incidents.",
  //   tech: ["Rust", "ratatui", "tokio"],
  //   demoUrl: "https://example.com/ferrite",
  //   repoUrl: "https://github.com/jus732",
  //   imageSeed: "ferrite-terminal-logs",
  // },
];

export type SkillGroup = {
  category: string;
  items: string[];
};

export const skills: SkillGroup[] = [
  {
    category: "Languages",
    items: ["TypeScript", "Javascript", "Python", "SQL"],
  },
  {
    category: "Frontend",
    items: ["React", "Next.js", "Tailwind CSS", "Framer Motion", "Accessibility"],
  },
  {
    category: "Backend & Infra",
    items: ["Node.js", "PostgreSQL", "Redis", "AWS", "Kubernetes"],
  },
  {
    category: "Practices",
    items: ["System design", "Observability", "CI/CD", "Code review", "Mentoring"],
  },
];

export const bio = [
  `I'm a software engineer with ${site.yearsOfExperience} years of experience shipping web platforms for fintech and developer tools companies. I've supported applications serving millions of requests a day, built components and systems adopted across product teams around the world, and mentored juniors from their first commit as interns to full-fledged engineers.`,
  "I look for performance, observability, and the craft of making complex systems feel simple to the people who use them.",
];

export const philosophy =
  "Software should be boring in the right places and everything else should be simple enough to debug at 3 a.m.";
