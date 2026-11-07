// Monorepo: Metro, paylaşılan paketleri (packages/*) de izler.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
