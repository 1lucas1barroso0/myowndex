const fs = process.getBuiltinModule('node:fs');
const path = process.getBuiltinModule('node:path');

class OfflineBuildAssetsPlugin {
  constructor(version) { this.version = version; }
  apply(compiler) {
    compiler.hooks.afterEmit.tap('MyOwnDexOfflineAssets', compilation => {
      const assets = compilation.getAssets().map(asset => asset.name)
        // Next also emits empty client stubs for API routes. They are not
        // browser screens and their [code] paths must never enter the shell.
        .filter(name => name.startsWith('static/') && !name.startsWith('static/chunks/app/api/') && /\.(js|css)$/.test(name)).sort();
      fs.writeFileSync(path.join(compiler.outputPath, 'offline-build-assets.json'), JSON.stringify({ version: this.version, assets }));
    });
  }
}

module.exports = { OfflineBuildAssetsPlugin };
