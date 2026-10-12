const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite web sürümü .wasm dosyası ister (yalnızca tarayıcı önizlemesi için).
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './global.css' });
