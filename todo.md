
export const projects: Project[] = [
{
slug: "ledgerline",
name: "Ledgerline",
description:
"Reconciliation engine that matches millions of payment events against ledger entries every night. Cut month-end close from four days to one afternoon.",
tech: ["TypeScript", "PostgreSQL", "Temporal", "AWS"],
demoUrl: "https://example.com/ledgerline",
repoUrl: "https://github.com/jus732",
imageSeed: "ledgerline-fintech-dashboard",
},
{
slug: "corvid",
name: "Corvid",
description:
"CI observability service that fingerprints flaky tests across thousands of pipeline runs. Surfaces the worst offenders before they erode trust in the build.",
tech: ["Go", "ClickHouse", "React", "Kubernetes"],
demoUrl: "https://example.com/corvid",
repoUrl: "https://github.com/jus732",
imageSeed: "corvid-ci-pipelines",
},
{
slug: "waypoint",
name: "Waypoint",
description:
"Feature flag platform with progressive rollouts and instant kill switches. Serves flag evaluations from the edge in under five milliseconds.",
tech: ["Next.js", "Cloudflare Workers", "Redis", "tRPC"],
demoUrl: "https://example.com/waypoint",
repoUrl: "https://github.com/jus732",
imageSeed: "waypoint-feature-flags",
},
{
slug: "quillmark",
name: "Quillmark",
description:
"Local-first markdown editor with CRDT sync across devices. Works fully offline and merges edits without conflicts when you reconnect.",
tech: ["TypeScript", "Yjs", "Tauri", "SQLite"],
demoUrl: "https://example.com/quillmark",
repoUrl: "https://github.com/jus732",
imageSeed: "quillmark-writing-desk",
},
{
slug: "hearthstat",
name: "Hearthstat",
description:
"Home energy monitor that streams smart meter data into live dashboards and nudges you when usage spikes. Runs happily on a shelf Raspberry Pi.",
tech: ["React", "MQTT", "TimescaleDB", "Grafana"],
demoUrl: "https://example.com/hearthstat",
repoUrl: "https://github.com/jus732",
imageSeed: "hearthstat-energy-home",
},
{
slug: "ferrite",
name: "Ferrite",
description:
"Terminal log viewer that tails, filters, and highlights gigabyte-scale files without breaking a sweat. Built for on-call engineers digging through incidents.",
tech: ["Rust", "ratatui", "tokio"],
demoUrl: "https://example.com/ferrite",
repoUrl: "https://github.com/jus732",
imageSeed: "ferrite-terminal-logs",
},
];

set up tests, jobs, docker(?)