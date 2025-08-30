// Test case: File renamed A.ts → B.ts → C.ts across commits
// Expected: WAS_RENAMED_FROM relationships linking the chain

MATCH (c:File {name: "C.ts"})-[:WAS_RENAMED_FROM]->(b:File {name: "B.ts"})-[:WAS_RENAMED_FROM]->(a:File {name: "A.ts"})
WHERE c.first_seen = 3 AND b.first_seen = 2 AND a.first_seen = 1
RETURN c.name, b.name, a.name;