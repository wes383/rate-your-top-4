import type { Metadata } from "next";
import { PrivacyView } from "@/components/privacy-view";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "这个站点收集与不收集什么，以及一次访问会触达哪些第三方服务。What this site collects, what it never does, and which third parties a visit touches.",
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
