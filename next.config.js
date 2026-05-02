/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use Terser instead of SWC so we can configure module-mode handling
  // of import.meta in onnxruntime-web's pre-bundled .mjs files.
  swcMinify: false,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Stub out Node-only bindings on the client side.
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        sharp$: false,
        "onnxruntime-node$": false,
      };
    }

    // Allow .mjs files to import CJS without requiring full specifiers.
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: { fullySpecified: false },
    });

    // Reconfigure Terser with module mode so `import.meta` syntax in
    // onnxruntime-web's pre-bundled ESM files is accepted instead of
    // throwing "import.meta cannot be used outside of module code".
    if (config.optimization?.minimizer) {
      const TerserPlugin = require("terser-webpack-plugin");
      config.optimization.minimizer = config.optimization.minimizer.map(
        (plugin) => {
          if (plugin.constructor.name === "TerserPlugin") {
            return new TerserPlugin({
              parallel: true,
              terserOptions: {
                ecma: 2020,
                module: true,
                compress: { ecma: 2020 },
                format: { ecma: 2020 },
                mangle: true,
              },
            });
          }
          return plugin;
        },
      );
    }

    return config;
  },

  experimental: {
    // Keep these heavy ML libs out of Next.js's server bundle graph —
    // they're only ever used in the browser via dynamic import.
    serverComponentsExternalPackages: [
      "@huggingface/transformers",
      "onnxruntime-node",
      "sharp",
    ],
    // Don't trace these into the serverless function bundle. This is what
    // keeps the function under Vercel's 250 MB unzipped limit.
    outputFileTracingExcludes: {
      "*": [
        "node_modules/@huggingface/transformers/**",
        "node_modules/onnxruntime-web/**",
        "node_modules/onnxruntime-node/**",
        "node_modules/sharp/**",
        "node_modules/@anthropic-ai/sdk/**/*.map",
      ],
    },
  },
};

module.exports = nextConfig;
