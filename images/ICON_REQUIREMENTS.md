# Extension Icon Requirements

## Marketplace Requirements

- **Size:** 128x128 pixels
- **Format:** PNG with transparency
- **Location:** `images/icon.png`
- **package.json:** Add `"icon": "images/icon.png"`

## Design Guidelines

### Concept: "Commentary on Documents"

The icon should convey:
1. **Commenting** - Speech bubble, annotation marker, or note
2. **Documents** - Paper, markdown file, or text
3. **Inline/Overlay** - Suggestion of commenting "on top of" content

### Design Options

#### Option A: Speech Bubble + Document
```
┌─────────────┐
│  📄         │  ← Document corner
│    💬      │  ← Speech bubble overlay
│             │
└─────────────┘
```
- Simple, recognizable metaphor
- Shows commenting functionality
- Easy to recognize at small sizes

#### Option B: Highlight Marker + Text
```
┌─────────────┐
│  ═══════   │  ← Highlighted text
│  ═══════   │
│  ═══════   │
└─────────────┘
```
- Represents highlight/annotation
- Matches the yellow highlighting in app
- Professional, minimalist

#### Option C: Note Icon + Document Fold
```
┌─────────────┐
│        ┌──┐ │  ← Folded corner
│  📝    └──┘ │  ← Note/comment icon
│             │
└─────────────┘
```
- Combines note-taking with documents
- Document fold is recognizable pattern
- Clear purpose

## Color Scheme

### Primary Options:
1. **VS Code Blue** - `#007ACC` (matches VS Code branding)
2. **Yellow/Gold** - `#FFD700` (matches highlight color in app)
3. **Gradient** - Blue → Yellow (combines both themes)

### Recommendation: VS Code Blue + Yellow Accent
- Base: VS Code blue (#007ACC)
- Accent: Yellow highlight (#FFD700)
- Background: White or transparent
- Border: Subtle gray for definition

## Technical Specs

```
Dimensions: 128x128px
DPI: 72 or higher
Color Mode: RGB
Alpha Channel: Yes (transparency)
File Format: PNG-24
File Size: < 50KB recommended
```

## icon.png Generation

You can create the icon using:

1. **Design Tool** (Figma, Sketch, Adobe XD)
   - Create 128x128px artboard
   - Export as PNG with transparency

2. **Code-Generated** (SVG → PNG)
   - Create SVG icon
   - Convert to PNG at 128x128px

3. **Icon Font** (Font Awesome, Material Icons)
   - Use existing icon font
   - Render at 128x128px
   - Export as PNG

## Recommended Design

**Concept:** Document with yellow highlight marker and blue speech bubble

```svg
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <!-- Document background -->
  <rect x="16" y="16" width="96" height="96" rx="8" fill="#ffffff" stroke="#007ACC" stroke-width="3"/>

  <!-- Text lines -->
  <line x1="28" y1="36" x2="100" y2="36" stroke="#cccccc" stroke-width="2"/>
  <line x1="28" y1="48" x2="100" y2="48" stroke="#cccccc" stroke-width="2"/>

  <!-- Yellow highlight -->
  <rect x="28" y="58" width="72" height="8" fill="#FFD700" opacity="0.6" rx="2"/>

  <!-- Text line under highlight -->
  <line x1="28" y1="62" x2="100" y2="62" stroke="#666666" stroke-width="2"/>

  <!-- Blue comment bubble -->
  <circle cx="92" cy="88" r="20" fill="#007ACC"/>
  <path d="M92 96 L88 102 L96 100 Z" fill="#007ACC"/>

  <!-- Comment icon inside bubble -->
  <text x="92" y="92" font-size="16" text-anchor="middle" fill="#ffffff">💬</text>
</svg>
```

## Next Steps

1. Create icon.png at 128x128px
2. Place in `/images/icon.png`
3. Update package.json: `"icon": "images/icon.png"`
4. Test in Extension Host
5. Verify appearance in marketplace preview
