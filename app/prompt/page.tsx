import type { Metadata } from "next";
import { PromptView } from "@/components/prompt-view";
import { readPrompts } from "@/lib/prompts";

export const metadata: Metadata = {
  title: "AI Prompt",
  description:
    "把 Top 4 电影品味构筑交给 AI 评审的可复制提示词。A copy-paste prompt for having an AI grade your Top 4 movie build.",
};

/**
 * The prompt markdown lives in `data/`, so it is read per request rather than
 * bundled — see `lib/prompts.ts`.
 */
export default function PromptPage() {
  return <PromptView prompts={readPrompts()} />;
}
