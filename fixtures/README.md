# SAGE Contract Fixtures

This directory contains normative fixtures that define the **exact** expected behavior for SAGE package implementations. Each fixture provides concrete input/output pairs that serve as the authoritative specification.

## Structure

- `canonical-json/` - JSON canonicalization and hashing fixtures
- `chronicle-events/` - Chronicle event serialization and ID computation
- `graph-schema/` - Graph queries with expected results
- `sha256/` - SHA256 hashing test vectors

## Usage

Contract implementers must ensure their code produces **bit-perfect** matches with these fixtures. No ambiguity about whitespace, key ordering, or hash encoding.

### Example: Canonical JSON

```ts
import { canonicalJSONStringify } from "@sage/utils";
import fs from "fs";

const input = JSON.parse(fs.readFileSync("fixtures/canonical-json/input.json"));
const expected = fs.readFileSync("fixtures/canonical-json/output.txt", "utf8");
const expectedHash = fs.readFileSync(
  "fixtures/canonical-json/output.sha256",
  "utf8"
);

const result = canonicalJSONStringify(input);
assert.strictEqual(result, expected);
assert.strictEqual(sha256(result), expectedHash);
```

## Adding New Fixtures

1. Create descriptive directory names that match contract acceptance tests
2. Provide both input and expected output files
3. Include hash/checksum files where determinism is critical
4. Update this README with usage examples
