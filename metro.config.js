// metro.config.js
const { getDefaultConfig } = require("@expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.unstable_enablePackageExports = true;

module.exports = {
    ...defaultConfig,
    transformer: {
        ...defaultConfig.transformer,
        minifierPath: require.resolve('metro-minify-terser'),
        minifierConfig: {
            // Terser options for better minification
            compress: {
                drop_console: true, // Remove console.logs in production
                passes: 3, // Multiple passes for better compression
            },
            mangle: {
                keep_fnames: false, // Mangle function names for smaller size
            },
            output: {
                comments: false, // Remove all comments
            },
        },
    },
    server: {
        ...defaultConfig.server,
        enhanceMiddleware: (middleware) => {
            return (req, res, next) => {
                // Set custom timeout (in milliseconds)
                req.setTimeout(30000); // 30 seconds
                res.setTimeout(30000); // 30 seconds

                return middleware(req, res, next);
            };
        },
    },
    watcher: {
        ...defaultConfig.watcher,
        unstable_lazySha1: true, // Enable lazy SHA1 computation for better performance
    },
};
