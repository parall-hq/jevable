# Changesets

A pull request that changes what `jevable` or `@jevable/core` ships (their
code, the guide, the README npm shows, their dependencies) adds a changeset:
run `npx changeset`, pick the bump (patch for a fix, minor for a feature) and
write one line for the changelog, then commit the file it writes here. CI
checks for it; `npx changeset --empty` records that a change needs no release.
Both packages always share one version.

Releases are run by hand with the release workflow, which turns the changesets
here into the next version and its changelog. See "Releasing" in the README.
