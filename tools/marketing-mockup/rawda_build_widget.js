// Builds a fake Android home-screen + Rawda widget mockup, then frames it in the
// phone mockup via rawda_build_full.js. There is no real screenshot of the widget
// on a device, so the home screen (icon grid + widget card) is drawn from scratch:
// - card has no border (the real widget - src/widgets/RawdaAffirmationWidget.tsx -
//   is a borderless cream/dark rounded rect), just a soft elevation shadow.
// - Arabic affirmation text uses the widget's real font (NotoNaskhArabic_600SemiBold,
//   from targets/widget/Fonts) instead of an invented one, rendered via
//   render_arabic_text.py (see that file for why: no HarfBuzz shaping available
//   through sharp/librsvg here).
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const build = require('./rawda_build_full.js');

const FONTS_DIR = path.join(__dirname, 'fonts');
const ARABIC_FONT = path.join(FONTS_DIR, 'NotoNaskhArabic_600SemiBold.ttf');
const APP_ICON = path.join(__dirname, '..', '..', '..', 'Rawda', 'assets', 'icon.png');

// sharp/librsvg here has no system fontconfig, so <text font-family="..."> in our
// SVG layers (brand name "Rawda") would fail to resolve without pointing it at a
// local fonts dir explicitly.
function ensureFontconfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rawda-fontconfig-'));
  const cacheDir = path.join(dir, 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONTS_DIR}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>`;
  const confPath = path.join(dir, 'fonts.conf');
  fs.writeFileSync(confPath, conf);
  process.env.FONTCONFIG_FILE = confPath;
}

function renderArabicText(text, { fontSize = 46, maxWidth = 1108, lineHeight = 62, color = '18140F' } = {}) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rawda-dua-')), 'dua.png');
  execFileSync('python3', [
    path.join(__dirname, 'render_arabic_text.py'),
    text, out,
    '--font', ARABIC_FONT,
    '--font-size', String(fontSize),
    '--max-width', String(maxWidth),
    '--line-height', String(lineHeight),
    '--color', color,
  ]);
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.affirmationText - Arabic dua/affirmation text shown in the widget card.
 * @param {string} opts.out - final framed-mockup output path.
 * @param {string} opts.line1 - headline line 1 (above the phone).
 * @param {string} opts.line2 - headline line 2.
 * @param {string} [opts.appName] - brand label in the widget card.
 * @param {number} [opts.iconRows] - rows of fake home-screen icon placeholders.
 */
async function buildWidgetMockup({
  affirmationText, out, line1, line2,
  appName = 'Rawda',
  iconRows = 2,
  frameStroke = '#B9A27A',
  frameStrokeWidth = 6,
}) {
  ensureFontconfig();

  const W = 1280, H = 2772;
  const cardX = 40, cardY = 620, cardW = 1200, cardH = 360, pad = 46;

  const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#FBF6EC"/>
  </svg>`;

  const iconGrid = (() => {
    let s = '';
    const cols = 5, gap = 60, rowGap = 70, size = 150;
    const totalW = cols * size + (cols - 1) * gap;
    const startX = (W - totalW) / 2;
    for (let r = 0; r < iconRows; r++) {
      const y = 160 + r * (size + rowGap);
      for (let i = 0; i < cols; i++) {
        const x = startX + i * (size + gap);
        s += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="36" fill="#EDE6D5"/>`;
      }
    }
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
  })();

  // Soft elevation shadow only - no hard border, matches the real widget's borderless look.
  const shadowSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter></defs>
    <rect x="${cardX}" y="${cardY + 14}" width="${cardW}" height="${cardH}" rx="44" fill="rgba(24,20,15,0.16)" filter="url(#b)"/>
  </svg>`;

  const cardSvg = `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${cardW}" height="${cardH}" rx="44" fill="#FFFFFF"/>
  </svg>`;

  const latinTextSvg = `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${pad + 76 + 16}" y="${pad + 50}" font-family="Plus Jakarta Sans" font-weight="800" font-size="34" fill="#18140F">${appName}</text>
  </svg>`;

  const iconBuf = await sharp(APP_ICON)
    .resize(76, 76)
    .composite([{ input: Buffer.from(`<svg width="76" height="76"><rect width="76" height="76" rx="18" fill="#fff"/></svg>`), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const duaPath = renderArabicText(affirmationText, { maxWidth: cardW - pad * 2 - 40 });
  const duaBuf = await sharp(duaPath).toBuffer();
  const duaMeta = await sharp(duaBuf).metadata();
  const duaLeft = cardX + cardW - pad - duaMeta.width;
  const duaTop = cardY + 150;

  const srcImg = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rawda-widget-src-')), 'src.png');
  await sharp(Buffer.from(bgSvg))
    .composite([
      { input: Buffer.from(iconGrid), top: 0, left: 0 },
      { input: Buffer.from(shadowSvg), top: 0, left: 0 },
      { input: Buffer.from(cardSvg), top: cardY, left: cardX },
      { input: iconBuf, top: cardY + pad, left: cardX + pad },
      { input: Buffer.from(latinTextSvg), top: cardY, left: cardX },
      { input: duaBuf, top: duaTop, left: duaLeft },
    ])
    .png()
    .toFile(srcImg);

  await build({ srcImg, out, line1, line2, frameStroke, frameStrokeWidth });
}

module.exports = buildWidgetMockup;
