#!/usr/bin/env node

import fs from "fs";
import { glob } from "glob";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🎯 LLM Context Limits (approximate token counts)
const LLM_LIMITS = {
  "gemini-pro": 2_000_000,    // 2M tokens
  "claude-3": 200_000,        // 200K tokens  
  "gpt-4": 128_000,          // 128K tokens
  "qwen": 32_000             // 32K tokens
};

// 📊 File priority weights (higher = more important for LLM understanding)
const FILE_PRIORITIES = {
  "README.md": 1000,
  "CLAUDE.md": 950,
  "/DOCS/README.md": 900,
  "/DOCS/Manifesto.md": 850,
  "/DOCS/Principles.md": 800,
  "/DOCS/Lexicon.md": 750,
  "package.json": 700,
  "/apps/*/README.md": 600,
  "/packages/*/README.md": 500,
  "/DOCS/**/*.md": 400,
  "**/*README*.md": 300,
  "**/*.md": 100
};

// 🎨 Styling constants
const EMOJI = {
  success: "✅",
  warning: "⚠️",
  error: "❌",
  info: "ℹ️",
  rocket: "🚀",
  gear: "⚙️",
  book: "📖",
  package: "📦",
  app: "🖥️",
  docs: "📚",
  file: "📄",
  stats: "📊",
  time: "⏱️"
};

async function findMarkdownFiles() {
  console.log(`${EMOJI.gear} Discovering markdown files...`);
  
  const patterns = ["**/*.md"];
  const ignore = [
    "**/node_modules/**",
    "**/dist/**", 
    "**/build/**",
    "**/coverage/**",
    "**/.git/**",
    "**/ALL.md",
    "**/CLAUDE.md", 
    "**/GEMINI.md",
    "**/QWEN.md",
    "**/.next/**",
    "**/target/**",
    "**/.ignored/**"
  ];

  const files = [];
  const errors = [];
  
  for (const pattern of patterns) {
    try {
      const matches = await glob(pattern, { 
        cwd: process.cwd(),
        ignore,
        nodir: true,
        absolute: false
      });
      files.push(...matches);
    } catch (error) {
      errors.push(`Pattern ${pattern}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    console.warn(`${EMOJI.warning} Glob errors:`, errors);
  }

  // Filter out development artifacts and non-public documentation
  const filteredFiles = files.filter(file => 
    !file.includes('node_modules') && 
    !file.includes('.ignored') &&
    !file.includes('/target/') &&
    !file.includes('/build/') &&
    !file.includes('/dist/') &&
    // Exclude development artifacts from public documentation
    !file.includes('/STORY-') &&
    !file.includes('/STORIES.md') &&
    !file.includes('/TODO.md') &&
    !file.includes('/NOTES.md') &&
    !file.includes('/PACKAGE_README_TEMPLATE.md') &&
    !file.includes('/Contract-LEGACY.md')
  );

  // Remove duplicates and sort
  const uniqueFiles = [...new Set(filteredFiles)].sort();
  console.log(`${EMOJI.info} Found ${uniqueFiles.length} markdown files`);
  
  // Debug: Show which files we're processing
  if (uniqueFiles.length < 20) {
    uniqueFiles.forEach(file => console.log(`  ${EMOJI.file} ${file}`));
  } else {
    console.log(`  ${EMOJI.file} First 10: ${uniqueFiles.slice(0, 10).join(', ')}`);
    console.log(`  ${EMOJI.file} Last 10: ${uniqueFiles.slice(-10).join(', ')}`);
  }
  
  return uniqueFiles;
}

// 🧮 Rough token estimation (1 token ≈ 4 chars for English text)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// 🎯 Calculate file priority based on path patterns
function getFilePriority(filePath) {
  const normalizedPath = "/" + filePath.replace(/\\/g, "/");
  
  for (const [pattern, priority] of Object.entries(FILE_PRIORITIES)) {
    if (pattern.includes("*")) {
      // Simple wildcard matching
      const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"));
      if (regex.test(normalizedPath)) {
        return priority;
      }
    } else if (normalizedPath.endsWith(pattern) || filePath === pattern.slice(1)) {
      return priority;
    }
  }
  return 50; // Default low priority
}

// 🏥 Health check for markdown files
function validateMarkdownFile(filePath, content) {
  const issues = [];
  const lines = content.split('\n');
  
  // Check for common issues
  if (content.length === 0) issues.push("Empty file");
  if (content.includes('\uFEFF')) issues.push("BOM detected");
  if (!/^#/.test(content.trim())) issues.push("No heading found");
  if (content.includes('```') && (content.match(/```/g) || []).length % 2 !== 0) {
    issues.push("Unclosed code block");
  }
  
  // Check for very long lines (potential formatting issues)  
  const longLines = lines.filter(line => line.length > 200).length;
  if (longLines > 3) issues.push(`${longLines} very long lines`);
  
  // Check for potentially unpublished package references
  const packageReferences = content.match(/@[a-z-]+\/[a-z-]+/g) || [];
  const potentiallyUnpublished = packageReferences.filter(pkg => 
    pkg.includes('@sage/') && !pkg.includes('@sage/analysis') // Add known published packages here
  );
  if (potentiallyUnpublished.length > 0) {
    issues.push(`References potentially unpublished packages: ${potentiallyUnpublished.join(', ')}`);
  }
  
  return {
    isHealthy: issues.length === 0,
    issues,
    stats: {
      lines: lines.length,
      chars: content.length,
      tokens: estimateTokens(content),
      codeBlocks: (content.match(/```/g) || []).length / 2
    }
  };
}

function readFileWithTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(process.cwd(), filePath);
    const health = validateMarkdownFile(filePath, content);
    
    if (!health.isHealthy) {
      console.warn(`${EMOJI.warning} Issues in ${relativePath}:`, health.issues.join(", "));
    }

    // 🎨 Determine section styling based on file path
    let { title, emoji } = categorizeFile(filePath, relativePath);
    
    const stats = `*${health.stats.lines} lines, ${health.stats.tokens} tokens*`;
    const hash = createHash('md5').update(content).digest('hex').slice(0, 8);
    
    return {
      title,
      relativePath, 
      content,
      stats,
      hash,
      emoji,
      priority: getFilePriority(filePath),
      health,
      formattedContent: `${emoji} ${title}\n\n> **📁 Source File:** \`${relativePath}\` • ${stats} • Hash: \`${hash}\`\n\n${content}\n\n---\n\n`
    };
  } catch (error) {
    console.error(`${EMOJI.error} Could not read ${filePath}: ${error.message}`);
    return null;
  }
}

// 🏷️ Smart file categorization
function categorizeFile(filePath, relativePath) {
  if (filePath === "README.md") {
    return { title: "# 🏠 Main Project README", emoji: EMOJI.rocket };
  }
  
  if (relativePath.startsWith("DOCS/")) {
    const filename = path.basename(filePath, ".md");
    if (filename === "README") return { title: "# 📚 Documentation Hub", emoji: "🏛️" };
    if (filename === "Manifesto") return { title: "# 📜 The SAGE Manifesto", emoji: "📜" };
    return { title: `# 📚 Documentation: ${filename}`, emoji: EMOJI.docs };
  }
  
  if (relativePath.includes("apps/")) {
    const parts = relativePath.split("/");
    const appName = parts[1];
    const fileName = path.basename(filePath, ".md");
    
    // Handle sub-files in apps
    if (fileName === "README") {
      return { title: `# 🖥️ App: ${appName} (README)`, emoji: EMOJI.app };
    } else {
      return { title: `# 🖥️ App: ${appName} (${fileName})`, emoji: EMOJI.app };
    }
  }
  
  if (relativePath.includes("packages/")) {
    const parts = relativePath.split("/");
    const packageName = parts[1];
    const fileName = path.basename(filePath, ".md");
    
    // Handle sub-files and stories in packages
    if (fileName === "README") {
      // Special handling for README files in subdirectories
      if (parts.length > 3) {
        // This is a README in a subdirectory, show the full path context
        const subPath = parts.slice(2, -1).join("/");
        return { title: `# 📦 Package: ${packageName} (${subPath}/README)`, emoji: EMOJI.package };
      } else {
        // This is the main package README
        return { title: `# 📦 Package: ${packageName} (README)`, emoji: EMOJI.package };
      }
    } else if (fileName === "CONTRACT") {
      return { title: `# 📦 Package: ${packageName} (CONTRACT)`, emoji: EMOJI.package };
    } else if (fileName.startsWith("STORY-")) {
      const storyTitle = fileName.replace("STORY-", "").replace(/-/g, " ");
      return { title: `# 📦 Package: ${packageName} (Story: ${storyTitle})`, emoji: EMOJI.package };
    } else if (relativePath.includes("/docs/")) {
      const subPath = parts.slice(3).join("/").replace(".md", "");
      return { title: `# 📦 Package: ${packageName} (docs/${subPath || fileName})`, emoji: EMOJI.package };
    } else if (relativePath.includes("/examples/")) {
      const subPath = parts.slice(3).join("/").replace(".md", "");
      return { title: `# 📦 Package: ${packageName} (examples/${subPath || fileName})`, emoji: EMOJI.package };
    } else {
      return { title: `# 📦 Package: ${packageName} (${fileName})`, emoji: EMOJI.package };
    }
  }
  
  if (relativePath.includes("archetypes/")) {
    const archetype = path.basename(filePath, ".md");
    return { title: `# 🎭 Archetype: ${archetype}`, emoji: "🎭" };
  }
  
  return { title: `# 📄 ${relativePath.replace("/", " › ")}`, emoji: EMOJI.file };
}

// 🎯 Generate optimized documentation for specific LLM
function generateOptimizedDocs(fileData, targetModel = "gemini-pro") {
  const limit = LLM_LIMITS[targetModel] || LLM_LIMITS["gemini-pro"];
  
  // Sort by priority (high to low)
  const sortedFiles = fileData.sort((a, b) => b.priority - a.priority);
  
  let totalTokens = 0;
  const includedFiles = [];
  const skippedFiles = [];
  
  // Include files until we hit token limit
  for (const fileInfo of sortedFiles) {
    const fileTokens = estimateTokens(fileInfo.formattedContent);
    if (totalTokens + fileTokens <= limit * 0.9) { // Keep 10% buffer
      includedFiles.push(fileInfo);
      totalTokens += fileTokens;
    } else {
      skippedFiles.push(fileInfo);
    }
  }
  
  return { includedFiles, skippedFiles, totalTokens, limit };
}

// 🎨 Create beautiful table of contents with stats
function createTableOfContents(files) {
  const grouped = {
    core: [],
    docs: [],
    apps: new Map(),
    packages: new Map(),
    other: []
  };
  
  files.forEach(file => {
    if (file.relativePath === "README.md" || file.relativePath.startsWith("CLAUDE")) {
      grouped.core.push(file);
    } else if (file.relativePath.startsWith("DOCS/")) {
      grouped.docs.push(file);
    } else if (file.relativePath.includes("apps/")) {
      const appName = file.relativePath.split("/")[1];
      if (!grouped.apps.has(appName)) {
        grouped.apps.set(appName, []);
      }
      grouped.apps.get(appName).push(file);
    } else if (file.relativePath.includes("packages/")) {
      const packageName = file.relativePath.split("/")[1];
      if (!grouped.packages.has(packageName)) {
        grouped.packages.set(packageName, []);
      }
      grouped.packages.get(packageName).push(file);
    } else {
      grouped.other.push(file);
    }
  });
  
  let toc = `## 📋 Table of Contents\n\n`;
  
  const addSection = (title, emoji, items) => {
    if (items.length === 0) return;
    toc += `### ${emoji} ${title}\n`;
    items.forEach(file => {
      const anchor = file.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const tokens = file.health.stats.tokens;
      toc += `- [${file.title.replace(/^# /, "")}](#${anchor}) *(${tokens} tokens)*\n`;
    });
    toc += `\n`;
  };
  
  const addGroupedSection = (title, emoji, groupedMap) => {
    if (groupedMap.size === 0) return;
    toc += `### ${emoji} ${title}\n`;
    for (const [groupName, groupFiles] of groupedMap) {
      if (groupFiles.length === 1) {
        // Single file, show directly
        const file = groupFiles[0];
        const anchor = file.title
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
        const tokens = file.health.stats.tokens;
        toc += `- [${file.title.replace(/^# /, "")}](#${anchor}) *(${tokens} tokens)*\n`;
      } else {
        // Multiple files, group them
        const totalTokens = groupFiles.reduce((sum, f) => sum + f.health.stats.tokens, 0);
        toc += `- **${groupName}** *(${totalTokens} tokens total)*\n`;
        groupFiles.forEach(file => {
          const anchor = file.title
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
          const tokens = file.health.stats.tokens;
          toc += `  - [${file.title.replace(/^# /, "")}](#${anchor}) *(${tokens} tokens)*\n`;
        });
      }
    }
    toc += `\n`;
  };
  
  addSection("Core", "🏠", grouped.core);
  addSection("Documentation", "📚", grouped.docs);
  addGroupedSection("Applications", "🖥️", grouped.apps);
  addGroupedSection("Packages", "📦", grouped.packages);
  addSection("Other", "📄", grouped.other);
  
  return toc;
}

// 🌐 Create sidebar structure for static site generators
function createSidebarStructure(files) {
  const grouped = {
    docs: [],
    apps: [],
    packages: []
  };
  
  files.forEach(file => {
    if (file.relativePath.startsWith("DOCS/")) {
      grouped.docs.push({
        text: path.basename(file.relativePath, '.md'),
        link: `/${file.relativePath.replace('.md', '')}`
      });
    } else if (file.relativePath.includes("apps/")) {
      grouped.apps.push({
        text: file.title.replace(/^# 🖥️ /, ''),
        link: `/${file.relativePath.replace('.md', '')}`
      });
    } else if (file.relativePath.includes("packages/")) {
      grouped.packages.push({
        text: file.title.replace(/^# 📦 /, ''),
        link: `/${file.relativePath.replace('.md', '')}`
      });
    }
  });
  
  return [
    { text: 'Documentation', collapsed: false, items: grouped.docs },
    { text: 'Applications', collapsed: false, items: grouped.apps },
    { text: 'Packages', collapsed: false, items: grouped.packages }
  ].filter(section => section.items.length > 0);
}

async function compileAllMarkdown(options = {}) {
  const startTime = Date.now();
  const { generateSiteStructure = false } = options;
  console.log(`${EMOJI.rocket} Starting fancy documentation compilation...`);
  if (generateSiteStructure) {
    console.log(`${EMOJI.gear} Static site structure generation enabled`);
  }
  
  const files = await findMarkdownFiles();
  
  // 📖 Read and analyze all files
  console.log(`${EMOJI.book} Reading and analyzing ${files.length} files...`);
  const fileData = files
    .map(readFileWithTitle)
    .filter(file => file !== null); // Remove failed reads
  
  if (fileData.length === 0) {
    console.error(`${EMOJI.error} No valid files found!`);
    return;
  }
  
  // 📊 Calculate statistics
  const totalLines = fileData.reduce((sum, file) => sum + file.health.stats.lines, 0);
  const totalTokens = fileData.reduce((sum, file) => sum + file.health.stats.tokens, 0);
  const totalChars = fileData.reduce((sum, file) => sum + file.health.stats.chars, 0);
  const healthyFiles = fileData.filter(file => file.health.isHealthy).length;
  
  console.log(`${EMOJI.stats} Statistics:`);
  console.log(`  📄 Files: ${fileData.length} (${healthyFiles} healthy)`);
  console.log(`  📏 Lines: ${totalLines.toLocaleString()}`);
  console.log(`  🔤 Characters: ${totalChars.toLocaleString()}`);
  console.log(`  🎯 Tokens: ${totalTokens.toLocaleString()}`);
  
  // 🎯 Generate optimized versions for different models
  const models = Object.keys(LLM_LIMITS);
  const optimizedDocs = {};
  
  for (const model of models) {
    optimizedDocs[model] = generateOptimizedDocs(fileData, model);
    const { includedFiles, skippedFiles, totalTokens: modelTokens } = optimizedDocs[model];
    console.log(`  ${model}: ${includedFiles.length}/${fileData.length} files (${modelTokens.toLocaleString()} tokens)`);
    if (skippedFiles.length > 0) {
      console.log(`    ${EMOJI.warning} Skipped ${skippedFiles.length} files due to token limit`);
    }
  }
  
  // 🎨 Create the main ALL.md (optimized for Gemini Pro)
  const { includedFiles } = optimizedDocs["gemini-pro"];
  const timestamp = new Date().toISOString();
  const buildTime = Date.now() - startTime;
  
  let compiledContent = `# 🌟 Complete SAGE Documentation\n\n`;
  compiledContent += `*Generated on ${timestamp} in ${buildTime}ms*\n\n`;
  compiledContent += `**SAGE** — *"A Codebase is a Living Society."*\n\n`;
  compiledContent += `This comprehensive document contains all README and documentation files from the project, `;
  compiledContent += `optimized for **Gemini Pro** (${totalTokens.toLocaleString()} total tokens).\n\n`;
  
  if (optimizedDocs["gemini-pro"].skippedFiles.length > 0) {
    compiledContent += `⚠️ **Note**: ${optimizedDocs["gemini-pro"].skippedFiles.length} files were skipped due to token limits.\n\n`;
  }
  
  compiledContent += `## 📊 Document Statistics\n\n`;
  compiledContent += `| Metric | Value |\n`;
  compiledContent += `|--------|-------|\n`;
  compiledContent += `| 📄 Total Files | ${fileData.length} |\n`;
  compiledContent += `| ✅ Healthy Files* | ${healthyFiles} |\n`;
  compiledContent += `| 📏 Total Lines | ${totalLines.toLocaleString()} |\n`;
  compiledContent += `| 🔤 Total Characters | ${totalChars.toLocaleString()} |\n`;
  compiledContent += `| 🎯 Estimated Tokens | ${totalTokens.toLocaleString()} |\n`;
  compiledContent += `| ⏱️ Build Time | ${buildTime}ms |\n\n`;
  compiledContent += `*Healthy files: Have proper headings, balanced code blocks, reasonable line lengths, and no encoding issues.\n\n`;
  
  compiledContent += createTableOfContents(includedFiles);
  compiledContent += `---\n\n`;
  
  // Add all file contents
  includedFiles.forEach(file => {
    compiledContent += file.formattedContent;
  });
  
  // 💾 Write the main file
  fs.writeFileSync("ALL.md", compiledContent);
  
  // 🤖 Generate model-specific optimized files
  try {
    const mainReadme = fs.readFileSync("README.md", "utf8");
    
    // CLAUDE.md: Just the main README (their default preference)
    fs.writeFileSync("CLAUDE.md", mainReadme);
    
    // GEMINI.md: Full ALL.md content (they love comprehensive context)
    fs.writeFileSync("GEMINI.md", compiledContent);
    
    // QWEN.md: Optimized subset for their smaller context
    const qwenOptimized = optimizedDocs["qwen"];
    let qwenContent = `# 🌟 SAGE Documentation (QWEN Optimized)\n\n`;
    qwenContent += `*Generated on ${timestamp} - Optimized for QWEN (${qwenOptimized.totalTokens.toLocaleString()}/${qwenOptimized.limit.toLocaleString()} tokens)*\n\n`;
    qwenContent += `**SAGE** — *"A Codebase is a Living Society."*\n\n`;
    qwenContent += `This document contains the highest-priority documentation files, optimized for QWEN's ${qwenOptimized.limit.toLocaleString()}-token context limit.\n\n`;
    qwenContent += `**Note**: ${qwenOptimized.skippedFiles.length} lower-priority files were omitted due to context limits.\n\n`;
    qwenContent += createTableOfContents(qwenOptimized.includedFiles);
    qwenContent += `---\n\n`;
    qwenOptimized.includedFiles.forEach(file => {
      qwenContent += file.formattedContent;
    });
    fs.writeFileSync("QWEN.md", qwenContent);
    
    console.log(`${EMOJI.success} Generated model-specific optimized files:`);
    console.log(`  CLAUDE.md: ${Math.round(mainReadme.length / 1024)} KB (main README only)`);
    console.log(`  GEMINI.md: ${Math.round(compiledContent.length / 1024)} KB (full documentation)`);
    console.log(`  QWEN.md: ${Math.round(qwenContent.length / 1024)} KB (${qwenOptimized.includedFiles.length} priority files)`);
  } catch (error) {
    console.warn(`${EMOJI.warning} Could not create model files: ${error.message}`);
  }
  
  // 🌐 Generate static site structure if requested
  if (generateSiteStructure) {
    try {
      console.log(`${EMOJI.gear} Generating static site structure...`);
      
      // Create docs directory structure
      if (!fs.existsSync('site-docs')) {
        fs.mkdirSync('site-docs', { recursive: true });
      }
      
      // Generate individual pages for each file
      includedFiles.forEach(file => {
        const siteDir = path.join('site-docs', path.dirname(file.relativePath));
        if (!fs.existsSync(siteDir)) {
          fs.mkdirSync(siteDir, { recursive: true });
        }
        
        const sitePath = path.join('site-docs', file.relativePath);
        fs.writeFileSync(sitePath, file.content);
      });
      
      // Generate sidebar/navigation config
      const sidebarConfig = {
        sidebar: {
          '/': [
            { text: 'Overview', link: '/README' },
            ...createSidebarStructure(includedFiles)
          ]
        }
      };
      
      fs.writeFileSync('site-docs/.vitepress-config.json', JSON.stringify(sidebarConfig, null, 2));
      console.log(`${EMOJI.success} Static site structure generated in ./site-docs/`);
    } catch (error) {
      console.warn(`${EMOJI.warning} Failed to generate site structure: ${error.message}`);
    }
  }
  
  // 📈 Final report
  console.log(`\n${EMOJI.success} Documentation compilation complete!`);
  console.log(`${EMOJI.file} ALL.md: ${Math.round(compiledContent.length / 1024)} KB`);
  console.log(`${EMOJI.time} Total time: ${Date.now() - startTime}ms`);
  
  // 🎯 Show optimization results
  console.log(`\n${EMOJI.gear} Model Optimization Results:`);
  for (const [model, result] of Object.entries(optimizedDocs)) {
    const pct = ((result.includedFiles.length / fileData.length) * 100).toFixed(1);
    console.log(`  ${model}: ${result.includedFiles.length}/${fileData.length} files (${pct}%) - ${result.totalTokens.toLocaleString()}/${result.limit.toLocaleString()} tokens`);
  }
  
  return {
    success: true,
    stats: { totalFiles: fileData.length, totalTokens, totalChars, totalLines, healthyFiles },
    optimizations: optimizedDocs
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    generateSiteStructure: args.includes('--site') || args.includes('-s')
  };
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${EMOJI.book} SAGE Documentation Compiler

Usage: node scripts/readme.js [options]

Options:
  --site, -s    Generate static site structure in ./site-docs/
  --help, -h    Show this help message

Examples:
  node scripts/readme.js           # Generate ALL.md and model-specific files
  node scripts/readme.js --site    # Also generate static site structure
    `);
    process.exit(0);
  }
  
  compileAllMarkdown(options);
}

export { compileAllMarkdown, findMarkdownFiles, readFileWithTitle };
