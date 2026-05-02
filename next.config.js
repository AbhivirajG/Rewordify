/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,

  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Stub out Node-only bindings on the client side
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        sharp$: false,
        "onnxruntime-node$": false,
      };
    }

    // Tell webpack these .mjs files are ES modules and shouldn't be transformed
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: "javascript/auto",
      resolve: {
        fullySpecified: false,
      },
    });

    // Completely skip processing of onnxruntime-web's pre-bundled files
    config.module.rules.push({
      test: /[\\/]node_modules[\\/]onnxruntime-web[\\/]dist[\\/]/,
      loader: "file-loader",
      options: {
        name: "static/chunks/[name].[hash].[ext]",
      },
      type: "javascript/auto",
    });

    // Don't parse onnxruntime-web - it's pre-bundled
    config.module.noParse = [
      /[\\/]node_modules[\\/]onnxruntime-web[\\/]/,
      /[\\/]node_modules[\\/]@huggingface[\\/]transformers[\\/]/,
    ];

    // Disable minification entirely for now to get the build working
    // This increases bundle size but ensures compatibility
    if (config.optimization) {
      config.optimization.minimize = false;
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
