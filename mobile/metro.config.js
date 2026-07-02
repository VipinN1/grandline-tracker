const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

// The website lives in the parent folder with its own node_modules (react-dom,
// vite, etc). Keep Metro from walking up the tree and bundling a second react.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]
config.resolver.disableHierarchicalLookup = true

module.exports = config
