import { HomeShell } from "@/components/home-shell";

/**
 * The homepage hosts both experiences: the classic hero and the desktop
 * environment. HomeShell decides which to render based on the user's
 * persisted mode preference.
 */
export default function HomePage() {
  return <HomeShell />;
}
