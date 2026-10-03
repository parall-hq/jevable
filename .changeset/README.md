# Changesets

A pull request that changes what people get from `jevable` or `@jevable/core`
adds a changeset: run `npx changeset`, pick the bump (patch for a fix, minor
for a feature) and write one line for the changelog, then commit the file it
writes here. Both packages always share one version.

Merged changesets collect in a "Version Packages" pull request that bumps the
versions and writes the changelogs; merging that pull request publishes to npm.
See "Releasing" in the README.
