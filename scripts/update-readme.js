// scripts/update-readme.js
import fs from "fs";
import path from "path";

// Path to the coverage summary file
const coverageSummaryPath = path.join(
  process.cwd(),
  "coverage/coverage-summary.json"
);
// Path to the README file
const readmePath = path.join(process.cwd(), "README.md");
// Placeholder comments in the README
const startComment = "<!-- VITEST-COVERAGE-START -->";
const endComment = "<!-- VITEST-COVERAGE-END -->";

function formatPercentage(covered, total) {
  if (total === 0) {
    return "100.00";
  }
  return ((covered / total) * 100).toFixed(2);
}

function generateMarkdownTable(summary) {
  const { total } = summary;

  // Create header and separator
  let table = "| Category    | Percentage | Covered/Total |\n";
  table += "|-------------|------------|---------------|\n";

  // Add rows for each category
  table += `| Statements  | \`${formatPercentage(total.statements.covered, total.statements.total)}%\` | \`${total.statements.covered}/${total.statements.total}\` |\n`;
  table += `| Branches    | \`${formatPercentage(total.branches.covered, total.branches.total)}%\` | \`${total.branches.covered}/${total.branches.total}\` |\n`;
  table += `| Functions   | \`${formatPercentage(total.functions.covered, total.functions.total)}%\` | \`${total.functions.covered}/${total.functions.total}\` |\n`;
  table += `| Lines       | \`${formatPercentage(total.lines.covered, total.lines.total)}%\` | \`${total.lines.covered}/${total.lines.total}\` |\n`;

  return table;
}

try {
  // Read the coverage summary
  const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, "utf8"));
  const table = generateMarkdownTable(summary);

  // Read the README
  let readme = fs.readFileSync(readmePath, "utf8");

  // Replace the content between the placeholders
  const regex = new RegExp(`${startComment}[\\s\\S]*${endComment}`);
  const newContent = `${startComment}\n${table}\n${endComment}`;

  if (regex.test(readme)) {
    readme = readme.replace(regex, newContent);
  } else {
    // If placeholders are not found, you might want to append or log an error
    console.error("Coverage placeholders not found in README.md");
    process.exit(1);
  }

  // Write the updated README
  fs.writeFileSync(readmePath, readme);
  console.log("✅ README.md updated with the latest coverage report.");
} catch (error) {
  console.error("❌ Failed to update README with coverage report:", error);
  process.exit(1);
}
