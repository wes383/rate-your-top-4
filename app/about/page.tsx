import type { Metadata } from "next";
import { AboutView } from "@/components/about-view";

export const metadata: Metadata = {
  title: "About",
  description:
    "这个站点是什么、为什么做它，以及 TMDB 的署名声明。What this site is, why it exists, and the TMDB attribution notice.",
};

export default function AboutPage() {
  return <AboutView />;
}
