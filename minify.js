const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

const files = [
  'index.html','shop.html','about.html','reviews.html','contact.html',
  'track-order.html','cart.html','checkout.html','success.html','explore.html',
  'product.html','admin-login.html','admin-dashboard.html','admin-products.html',
  'admin-orders.html','admin-reviews.html','404.html'
];

const PUBLIC_DIR = path.join(__dirname, 'public');
const BACKUP_DIR = path.join(__dirname, 'public-original');

async function main() {
  console.log('Starting minify...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    for (const f of files) {
      const src = path.join(PUBLIC_DIR, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(BACKUP_DIR, f));
    }
    console.log('Backup created in public-original/');
  }

  for (const f of files) {
    const backup = path.join(BACKUP_DIR, f);
    const target = path.join(PUBLIC_DIR, f);
    const source = fs.existsSync(backup) ? backup : target;
    if (!fs.existsSync(source)) continue;

    const html = fs.readFileSync(source, 'utf8');
    const out = await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true
    });
    fs.writeFileSync(target, out, 'utf8');
    console.log('OK: ' + f + '  (' + html.length + ' -> ' + out.length + ' bytes)');
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
