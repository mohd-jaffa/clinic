import type { NextConfig } from "next";

import { version } from "./package.json";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  // Settings shows it, and every error report can name the build it came from.
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // The faces the PDFs are drawn in (plan §33), read from disk by the routes that draw them.
  outputFileTracingIncludes: { "/api/**/*.pdf": ["./public/fonts/pdf/**"] },
};

export default nextConfig;
