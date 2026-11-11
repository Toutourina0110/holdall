# holdall-registry template

This folder is the starting content of the `holdall-registry` GitHub repository that the Holdall plugin store reads.

To create the official registry (maintainer, once):

1. Create a public repository named `holdall-registry` on GitHub.
2. Copy `index.json`, `validate.mjs` and the `.github` folder from here into it.
3. For each example plugin, run `node scripts/pack-plugin.mjs examples/plugins/<name>` in the Holdall repository, create a release named `<name>-<version>` in `holdall-registry` and attach the archive.
4. Check that the `sha256` values in `index.json` match the printed ones, then push.

Holdall reads `https://raw.githubusercontent.com/Toutourina0110/holdall-registry/main/index.json` by default. Set `PLUGIN_REGISTRY_URL` to use a mirror.

Pull requests run `validate.mjs`, which checks every entry, downloads each archive and compares its checksum.
