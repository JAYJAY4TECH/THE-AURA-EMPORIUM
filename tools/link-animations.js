const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');
const files = fs.readdirSync(publicDir).filter((name) => name.endsWith('.html'));

const googleFonts = '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">';
const fontAwesome = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">';
const bootstrap = '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">';

for (const file of files) {
  const filePath = path.join(publicDir, file);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('/animations.css')) {
    continue;
  }

  if (html.includes('fonts.googleapis.com')) {
    html = html.replace(googleFonts, googleFonts + '\n    <link rel="stylesheet" href="/animations.css">');
  } else if (html.includes('cdnjs.cloudflare.com/ajax/libs/font-awesome')) {
    html = html.replace(fontAwesome, fontAwesome + '\n    <link rel="stylesheet" href="/animations.css">');
  } else if (html.includes('bootstrap@5.3.2')) {
    html = html.replace(bootstrap, bootstrap + '\n    <link rel="stylesheet" href="/animations.css">');
  } else {
    html = html.replace('</head>', '    <link rel="stylesheet" href="/animations.css">\n</head>');
  }

  fs.writeFileSync(filePath, html);
}

console.log(`Updated ${files.length} HTML files with /animations.css`);
