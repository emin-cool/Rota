const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

// getSentryExpoConfig = expo'nun varsayılan Metro ayarı + Sentry hata ayıklama kimlikleri (kaynak haritası eşleşmesi).
const config = getSentryExpoConfig(__dirname);

// expo-sqlite web sürümü .wasm dosyası ister (yalnızca tarayıcı önizlemesi için).
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './global.css' });
