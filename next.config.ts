import type { NextConfig } from "next";

/**
 * Fake-IP proxies (Clash, Surge, sing-box, ...) answer every DNS lookup with a
 * synthetic address inside 198.18.0.0/15. The image optimizer treats that as an
 * internal target and refuses to fetch it, so every remote poster fails with
 * "hostname resolved to private IP" even though the network is fine.
 *
 * Setting this env flag to `1` lifts that guard. It stays off by default so a
 * deployment with normal DNS keeps the SSRF protection enabled.
 */
const allowLocalImageHosts = process.env.ALLOW_PRIVATE_IMAGE_HOSTS === "1";

const nextConfig: NextConfig = {
  /**
   * The /prompt route reads its copy-paste prompt out of `data/` at request
   * time (`lib/prompts.ts`), which the output file trace cannot see on its own.
   */
  outputFileTracingIncludes: {
    "/prompt": ["./data/movie-taste-build.*.md"],
  },
  images: {
    dangerouslyAllowLocalIP: allowLocalImageHosts,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
