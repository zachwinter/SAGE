/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  name: "SAGE Contract Types",
  entryPoints: ["contract-types.ts"],
  out: "docs/types",
  tsconfig: "tsconfig.types.json",
  readme: "none",
  includeVersion: true,
  sort: ["source-order"],
  hideGenerator: false,
  skipErrorChecking: true
};
