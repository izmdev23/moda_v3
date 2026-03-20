const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// dotLottie animations are bundled as assets.
config.resolver.assetExts.push('lottie');

// Enable experimental tree shaking and minification
if (process.env.NODE_ENV === 'production') {
    config.transformer.minifierPath = 'metro-minify-terser';
    config.transformer.minifierConfig = {
        // https://www.npmjs.com/package/terser#minify-options
        compress: {
            drop_console: true,
        },
    };
}

module.exports = config;
