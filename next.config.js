/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Disable SWC minification and use Terser instead.
  // This allows us to exclude onnxruntime-web from minification.
  swcMinify: false,

  webpack: (config, { isServer, webpack }) => {
    // Stub out Node-only bindings on the client side
    if (!isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        sharp$: false,
        "onnxruntime-node$": false,
      };
    }

    // onnxruntime-web ships pre-bundled, pre-minified .mjs files that use
    // `import.meta`. We need to:
    // 1. Tell webpack not to parse them (they're already bundled)
    // 2. Treat .mjs files as ES modules
    // 3. Exclude them from Terser minification

    // Ensure .mjs files resolve correctly
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: { fullySpecified: false },
    });

    // Don't parse onnxruntime-web - it's pre-bundled
    config.module.noParse = /onnxruntime-web/;

    // Exclude onnxruntime-web from Terser minification
    if (config.optimization?.minimizer) {
      config.optimization.minimizer = config.optimization.minimizer.map(
        (minimizer) => {
          if (minimizer.constructor?.name === "TerserPlugin") {
            return new minimizer.constructor({
              ...minimizer.options,
              exclude: /onnxruntime-web/,
            });
          }
          return minimizer;
        }
      );
    }

    return config;
  },

  experimental: {
    serverComponentsExternalPackages: [
      "@huggingface/transformers",
      "onnxruntime-node",
      "sharp",
    ],
  },
};

module.exports = nextConfig;
