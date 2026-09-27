import type { Metadata } from "next";

/**
 * The page itself is a client component (so the language toggle applies live),
 * which means it cannot export `metadata` directly — this server layout carries
 * the route metadata instead.
 */
export const metadata: Metadata = {
  title: "Scoring algorithm",
  description:
    "两层评分算法的完整说明：单部电影的四个维度与 Top 4 Build 的五个维度、每一项权重与阈值、规则加减分、Level 系统、属性面板与数据置信度。Full documentation of the two-layer scoring algorithm.",
};

export default function MethodLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
