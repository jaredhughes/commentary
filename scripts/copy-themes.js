#!/usr/bin/env node
/**
 * Copy theme CSS files from node_modules to media/themes/
 * Runs during build to bundle themes with the extension
 *
 * Handles git worktrees by finding the actual node_modules directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Find the git repository root (handles worktrees correctly)
 * Falls back to current directory if not in a git repo
 */
function findRepoRoot() {
  try {
    // git rev-parse --show-toplevel gives worktree root
    // We need the actual repository root with node_modules
    const gitDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf8' }).trim();

    // If .git is a directory, we're in the base repo
    // If .git is a file (worktree), gitDir points to .git/worktrees/xxx
    // In both cases, going up to the directory containing .git gives us the repo root
    const repoRoot = path.dirname(path.resolve(gitDir));

    console.log(`📍 Resolved repository root: ${repoRoot}`);
    return repoRoot;
  } catch (error) {
    // Not in a git repo, use current directory
    console.log('📍 Not in git repo, using current directory');
    return path.join(__dirname, '..');
  }
}

const repoRoot = findRepoRoot();
const workingDir = path.join(__dirname, '..');

// Ensure themes directory exists in working directory
const themesDir = path.join(workingDir, 'media', 'themes');
if (!fs.existsSync(themesDir)) {
  fs.mkdirSync(themesDir, { recursive: true });
}

const themes = [
  // Water.css - Modern, beautiful
  {
    src: 'node_modules/water.css/out/light.css',
    dest: 'media/themes/water-light.css'
  },
  {
    src: 'node_modules/water.css/out/dark.css',
    dest: 'media/themes/water-dark.css'
  },

  // Simple.css - Minimalist, auto dark/light
  {
    src: 'node_modules/simpledotcss/simple.css',
    dest: 'media/themes/simple.css'
  },

  // Sakura.css - Elegant variants
  {
    src: 'node_modules/sakura.css/css/sakura.css',
    dest: 'media/themes/sakura-light.css'
  },
  {
    src: 'node_modules/sakura.css/css/sakura-dark.css',
    dest: 'media/themes/sakura-dark.css'
  },
  {
    src: 'node_modules/sakura.css/css/sakura-vader.css',
    dest: 'media/themes/sakura-vader.css'
  },
  {
    src: 'node_modules/sakura.css/css/sakura-pink.css',
    dest: 'media/themes/sakura-pink.css'
  },
  {
    src: 'node_modules/sakura.css/css/sakura-earthly.css',
    dest: 'media/themes/sakura-earthly.css'
  },

  // Pico CSS - Professional, semantic (classless, uses system dark mode)
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.amber.css',
    dest: 'media/themes/pico-amber.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.blue.css',
    dest: 'media/themes/pico-blue.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.cyan.css',
    dest: 'media/themes/pico-cyan.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.green.css',
    dest: 'media/themes/pico-green.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.grey.css',
    dest: 'media/themes/pico-grey.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.pink.css',
    dest: 'media/themes/pico-pink.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.purple.css',
    dest: 'media/themes/pico-purple.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.red.css',
    dest: 'media/themes/pico-red.css'
  },

  // Matcha CSS - Code-focused
  {
    src: 'node_modules/@lowlighter/matcha/dist/matcha.css',
    dest: 'media/themes/matcha.css'
  },

  // LaTeX.css - Academic paper styling
  {
    src: 'node_modules/latex.css/style.css',
    dest: 'media/themes/latex.css'
  },

  // Tufte CSS - Edward Tufte inspired
  {
    src: 'node_modules/tufte-css/tufte.css',
    dest: 'media/themes/tufte.css'
  },

  // New.css - Modern minimal
  {
    src: 'node_modules/@exampledev/new.css/new.css',
    dest: 'media/themes/new.css'
  },

  // Highlight.js - Syntax highlighting for code blocks
  // Using Atom One themes - vibrant, balanced colors without excessive orange
  {
    src: 'node_modules/highlight.js/styles/atom-one-light.css',
    dest: 'media/highlight-light.css'
  },
  {
    src: 'node_modules/highlight.js/styles/atom-one-dark.css',
    dest: 'media/highlight-dark.css'
  }
];

let copied = 0;
let failed = 0;

console.log('📦 Copying theme CSS files...\n');

for (const { src, dest } of themes) {
  // Source files are always in repo root's node_modules
  const fullSrc = path.join(repoRoot, src);
  // Destination is in the working directory (could be worktree or base repo)
  const fullDest = path.join(workingDir, dest);

  try {
    if (!fs.existsSync(fullSrc)) {
      console.error(`❌ Source not found: ${src}`);
      console.error(`   Looked in: ${fullSrc}`);
      failed++;
      continue;
    }

    const content = fs.readFileSync(fullSrc, 'utf8');
    fs.writeFileSync(fullDest, content, 'utf8');
    console.log(`✓ ${path.basename(dest)}`);
    copied++;
  } catch (error) {
    console.error(`❌ Failed to copy ${path.basename(dest)}: ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 Summary: ${copied} copied, ${failed} failed`);

// Also copy codicons for webview access
console.log('\n📦 Copying codicons...');
// Source is always in repo root's node_modules
const codiconsSource = path.join(repoRoot, 'node_modules/@vscode/codicons/dist');
// Target is in working directory
const codiconsTarget = path.join(workingDir, 'media/codicons');

try {
  if (!fs.existsSync(codiconsSource)) {
    console.error(`❌ Codicons source not found: ${codiconsSource}`);
    failed++;
  } else {
    // Create codicons directory
    if (!fs.existsSync(codiconsTarget)) {
      fs.mkdirSync(codiconsTarget, { recursive: true });
    }

    // Copy codicon files (css, ttf)
    const codiconFiles = fs.readdirSync(codiconsSource).filter(f =>
      f.startsWith('codicon.') && (f.endsWith('.css') || f.endsWith('.ttf'))
    );

    for (const file of codiconFiles) {
      fs.copyFileSync(
        path.join(codiconsSource, file),
        path.join(codiconsTarget, file)
      );
      console.log('✓', file);
    }

    console.log('\n✅ Codicons copied successfully');
  }
} catch (error) {
  console.error('❌ Failed to copy codicons:', error.message);
  failed++;
}

if (failed > 0) {
  process.exit(1);
}
