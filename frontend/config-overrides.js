// config-overrides.js
const webpack = require('webpack');

module.exports = {
  webpack: function override(config, env) {
    // Disable sourcemap generation to prevent memory exhaustion and drastically speed up compilation
    config.devtool = false;

    // In production (Vercel CI), disable disk cache and throttle minifier to prevent container memory limit crashes (exit code 137)
    if (env === 'production' || process.env.CI || process.env.VERCEL) {
      config.cache = false;
      if (config.optimization && config.optimization.minimizer) {
        config.optimization.minimizer.forEach(minimizer => {
          if (minimizer && minimizer.constructor && minimizer.constructor.name === 'TerserPlugin') {
            if (minimizer.options) {
              minimizer.options.parallel = false;
            }
          }
        });
      }
    } else {
      // Use persistent filesystem caching for ultra-fast startup and hot reloads in dev
      config.cache = {
        type: 'filesystem',
        allowCollectingMemory: true,
      };
    }

    // Remove source-map-loader which severely slows down processing heavy packages like @tensorflow & face-api
    if (config.module && config.module.rules) {
      config.module.rules = config.module.rules.filter(rule => {
        if (rule.loader && rule.loader.includes('source-map-loader')) return false;
        if (rule.use && Array.isArray(rule.use) && rule.use.some(u => (typeof u === 'string' ? u : u.loader || '').includes('source-map-loader'))) return false;
        return true;
      });
    }

    // Remove ESLint plugin from webpack in dev mode if present (already checked or handled)
    config.plugins = (config.plugins || []).filter(p => {
      const name = p && p.constructor && p.constructor.name;
      return name !== 'ESLintWebpackPlugin' && name !== 'ForkTsCheckerWebpackPlugin';
    });

    // Add fallbacks for Node.js core modules in Webpack 5
    config.resolve = config.resolve || {};
    config.resolve.symlinks = false;
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "buffer": require.resolve("buffer/"),
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "process": require.resolve("process/browser.js"),
      "fs": false,
      "vm": false
    };
    
    // Add plugins
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser.js',
        Buffer: ['buffer', 'Buffer']
      })
    );
    
    // Ignore non-fatal warnings for TensorFlow, @vladmandic/face-api, node_modules, etc.
    config.ignoreWarnings = [
      /Failed to parse source map/,
      /node_modules/,
      /Critical dependency/,
      /browserslist/,
      function() { return true; }
    ];

    // Silence asset size recommendation warnings
    config.performance = {
      hints: false,
      maxEntrypointSize: 5120000,
      maxAssetSize: 5120000,
    };
    
    return config;
  },
  devServer: function(configFunction) {
    return function(proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);
      config.allowedHosts = ['all'];
      config.open = false;
      config.historyApiFallback = true;
      return config;
    };
  }
};