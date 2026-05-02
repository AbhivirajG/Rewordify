/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Stub out Node-only bindings on the client side
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        sharp$: false,
        "onnxruntime-node$": false,
      };

      // Put onnxruntime-web in its own named chunk so we can exclude it from minification
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          onnxruntime: {
            test: /[\\/]node_modules[\\/]onnxruntime-web[\\/]/,
            name: "onnxruntime-vendor",
            chunks: "all",
            enforce: true,
            priority: 100,
          },
        },
      };
    }

    // Don't parse onnxruntime-web - it's pre-bundled
    config.module.noParse = /onnxruntime-web/;

    // Ensure .mjs files resolve correctly
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: { fullySpecified: false },
    });

    // Replace TerserPlugin with one that excludes the onnxruntime chunk
    if (config.optimization?.minimizer) {
      config.optimization.minimizer = config.optimization.minimizer.map(
        (plugin) => {
          if (
            plugin.constructor.name === "TerserPlugin" ||
            plugin.constructor.name === "TerserPlugin"
          ) {
            const TerserPlugin = require("terser-webpack-plugin");
            return new TerserPlugin({
              parallel: true,
              exclude: /onnxruntime/,
              terserOptions: {
                compress: true,
                mangle: true,
              },
            });
          }
          return plugin;
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
