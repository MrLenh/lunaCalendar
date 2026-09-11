// Metro configuration for running Expo inside a pnpm monorepo.
// Follows the standard Expo monorepo recipe:
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so changes in packages/* are picked up.
config.watchFolders = [workspaceRoot];

// Resolve node_modules from this app first, then fall back to the
// workspace root (pnpm hoists shared deps like react/react-native there).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm links workspace packages (@luna/lunar-calendar, @luna/shared-types)
// via symlinks into node_modules - make sure Metro follows them instead of
// treating them as opaque/hoisted-only paths.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
