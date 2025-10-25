#!/usr/bin/env node
/**
 * Copy theme CSS files from node_modules to media/themes/
 * Runs during build to bundle themes with the extension
 */

const fs = require('fs');
const path = require('path');

// Ensure themes directory exists
const themesDir = path.join(__dirname, '..', 'media', 'themes');
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

  // Pico CSS - Professional, semantic (classless auto dark/light)
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.conditional.amber.css',
    dest: 'media/themes/pico-amber.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.conditional.blue.css',
    dest: 'media/themes/pico-blue.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.conditional.cyan.css',
    dest: 'media/themes/pico-cyan.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.conditional.green.css',
    dest: 'media/themes/pico-green.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.conditional.grey.css',
    dest: 'media/themes/pico-grey.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.conditional.pink.css',
    dest: 'media/themes/pico-pink.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.conditional.purple.css',
    dest: 'media/themes/pico-purple.css'
  },
  {
    src: 'node_modules/@picocss/pico/css/pico.classless.conditional.red.css',
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
  const fullSrc = path.join(__dirname, '..', src);
  const fullDest = path.join(__dirname, '..', dest);

  try {
    if (!fs.existsSync(fullSrc)) {
      console.error(`❌ Source not found: ${src}`);
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

if (failed > 0) {
  process.exit(1);
}
