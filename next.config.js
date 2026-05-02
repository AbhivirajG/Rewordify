/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Transformers.js ships optional Node-only bindings (sharp, onnxruntime-node)
  // that we never touch in the browser. Stub them out so webpack doesn't try
  // to bundle them client-side.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        sharp$: false,
        "onnxruntime-node$": false,
      };
    }

    // onnxruntime-web ships pre-bundled, pre-minified .mjs files (e.g.
    // ort.webgpu.bundle.min.mjs) that use top-level `import.meta`. Without
    // these tweaks Next 14's webpack tries to re-parse and re-minify them
    // as plain scripts and Terser blows up with:
    //   "import.meta cannot be used outside of module code"
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: { fullySpecified: false },
    });
    config.module.noParse = /onnxruntime-web/;

    if (config.optimization?.minimizer) {
      config.optimization.minimizer.forEach((plugin) => {
        if (plugin.constructor?.name === "TerserPlugin") {
          plugin.options = plugin.options || {};
          plugin.options.exclude = /onnxruntime-web|@huggingface\/transformers/;
        }
      });
    }

    return config;
  },

  // Next 14 still uses the experimental flag for server-only packages.
  experimental: {
    serverComponentsExternalPackages: [
      "@huggingface/transformers",
      "onnxruntime-node",
      "sharp",
    ],
  },
};

module.exports = nextConfig;
