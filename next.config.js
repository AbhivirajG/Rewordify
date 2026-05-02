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
