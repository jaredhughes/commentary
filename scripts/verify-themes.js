#!/usr/bin/env node
/**
 * Verify theme CSS files are present and valid
 */

const fs = require('fs');
const path = require('path');

const themesDir = path.join(__dirname, '..', 'media', 'themes');

// Expected themes
const expectedThemes = [
  'water-light.css',
  'water-dark.css',
  'simple.css',
  'sakura-light.css',
  'sakura-dark.css',
  'sakura-vader.css',
  'sakura-pink.css',
  'sakura-earthly.css',
  'pico-amber.css',
  'pico-blue.css',
  'pico-cyan.css',
  'pico-green.css',
  'pico-grey.css',
  'pico-pink.css',
  'pico-purple.css',
  'pico-red.css',
  'matcha.css',
  'latex.css',
  'tufte.css',
  'new.css',
];

console.log('?? Verifying theme files...\n');

let allValid = true;

for (const themeName of expectedThemes) {
  const themePath = path.join(themesDir, themeName);
  
  if (!fs.existsSync(themePath)) {
    console.error(`? Missing: ${themeName}`);
    allValid = false;
    continue;
  }
  
  const stats = fs.statSync(themePath);
  const content = fs.readFileSync(themePath, 'utf8');
  
  // Basic validation
  const hasContent = content.length > 100;
  const hasCssRules = content.includes('{') && content.includes('}');
  const isPico = themeName.startsWith('pico-');
  const hasPicoVars = isPico ? content.includes('--pico-') : true;
  
  if (!hasContent || !hasCssRules) {
    console.error(`? Invalid: ${themeName} (too short or no CSS rules)`);
    allValid = false;
  } else if (isPico && !hasPicoVars) {
    console.error(`??  Warning: ${themeName} missing Pico CSS variables`);
  } else {
    console.log(`? ${themeName} (${(stats.size / 1024).toFixed(1)}KB, ${content.split('\n').length} lines)`);
    
    // Log Pico-specific info
    if (isPico) {
      const hasMediaQuery = content.includes('@media');
      const hasDataTheme = content.includes('[data-theme');
      const hasPrefersColorScheme = content.includes('prefers-color-scheme');
      console.log(`  - Media queries: ${hasMediaQuery ? 'yes' : 'no'}`);
      console.log(`  - [data-theme]: ${hasDataTheme ? 'yes' : 'no'}`);
      console.log(`  - prefers-color-scheme: ${hasPrefersColorScheme ? 'yes (conditional)' : 'no (static)'}`);
    }
  }
}

console.log('\n?? Summary:');
console.log(`Total themes: ${expectedThemes.length}`);
console.log(`Status: ${allValid ? '? All themes valid' : '? Some themes have issues'}`);

if (!allValid) {
  process.exit(1);
}
