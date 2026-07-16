"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

import { GithubIcon } from "@/components/ui/icons/brand";

import { projects, type Project } from "@/lib/site";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/motion/reveal";
import { cn } from "@/lib/utils";

function ProjectCard({ project, featured }: { project: Project; featured?: boolean }) {
  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/50",
        featured && "@3xl:flex-row"
      )}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden bg-muted",
          featured && "@3xl:aspect-auto @3xl:w-1/2 @3xl:shrink-0"
        )}
      >
        <Image
          src={`https://picsum.photos/seed/${project.imageSeed}/960/540`}
          alt={`${project.name} preview`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{project.name}</h3>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${project.name} live demo`}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
            >
              <ArrowUpRight className="size-4" />
            </a>
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${project.name} source on GitHub`}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
            >
              <GithubIcon />
            </a>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {project.description}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {project.tech.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[11px]">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </article>
  );
}

/**
 * Project grid shared by the classic /projects page and the desktop
 * Projects window. Container queries keep columns sane at any surface width.
 */
export function ProjectsGrid() {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2 @5xl:grid-cols-3">
        {projects.map((project, i) => (
          <Reveal
            key={project.slug}
            delay={i * 0.05}
            className={cn(i === 0 && "@3xl:col-span-2")}
          >
            <ProjectCard project={project} featured={i === 0} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
