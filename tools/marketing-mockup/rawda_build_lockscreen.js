// Builds a fake Android lockscreen + Rawda notification mockup, then frames it via
// rawda_build_full.js. Same reasoning as rawda_build_widget.js: no real device
// capture of a Rawda notification on a locked screen exists, so the lockscreen
// (time + notification card) is drawn from scratch, reusing the same borderless
// card style and the real NotoNaskhArabic widget font for the Arabic body text.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const build = require('./rawda_build_full.js');

const FONTS_DIR = path.join(__dirname, 'fonts');
const ARABIC_FONT = path.join(FONTS_DIR, 'NotoNaskhArabic_600SemiBold.ttf');
const APP_ICON = path.join(__dirname, '..', '..', '..', 'Rawda', 'assets', 'icon.png');

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

function renderArabicText(text, { fontSize = 40, maxWidth = 900, lineHeight = 56, color = '18140F' } = {}) {
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
 * @param {string} opts.affirmationText - Arabic dua/affirmation text shown in the notification body.
 * @param {string} opts.out - final framed-mockup output path.
 * @param {string} opts.line1 - headline line 1 (above the phone).
 * @param {string} opts.line2 - headline line 2.
 * @param {string} [opts.appName] - notification title.
 * @param {string} [opts.timeLabel] - big lockscreen clock text.
 * @param {string} [opts.dateLabel] - date line under the clock.
 * @param {string} [opts.timestampLabel] - notification timestamp ("maintenant").
 */
async function buildLockscreenMockup({
  affirmationText, out, line1, line2,
  appName = 'Rawda',
  timeLabel = '9:41',
  dateLabel = 'Mercredi 18 novembre',
  timestampLabel = 'maintenant',
  frameStroke = '#B9A27A',
  frameStrokeWidth = 6,
}) {
  ensureFontconfig();

  const W = 1280, H = 2772;
  const cardX = 40, cardY = 900, cardW = 1200, pad = 40;

  const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#FBF6EC"/>
  </svg>`;

  // Clock (large, light weight like a real lockscreen) + date + a small padlock glyph, so it
  // visibly reads as a locked screen rather than just a clock. Pushed well below the top of the
  // frame so the phone mockup's dynamic-island notch doesn't overlap the clock digits.
  const clockSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <text x="${W / 2}" y="450" font-family="Plus Jakarta Sans" font-weight="300" font-size="190" fill="#18140F" text-anchor="middle">${timeLabel}</text>
    <text x="${W / 2}" y="520" font-family="Nunito" font-weight="600" font-size="40" fill="#5A5446" text-anchor="middle">${dateLabel}</text>
    <g transform="translate(${W / 2 - 22}, 580)" fill="none" stroke="#5A5446" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="20" width="36" height="28" rx="6"/>
      <path d="M 12 20 L 12 12 A 10 10 0 0 1 32 12 L 32 20"/>
    </g>
  </svg>`;

  const iconBuf = await sharp(APP_ICON)
    .resize(64, 64)
    .composite([{ input: Buffer.from(`<svg width="64" height="64"><rect width="64" height="64" rx="16" fill="#fff"/></svg>`), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const duaPath = renderArabicText(affirmationText, { maxWidth: cardW - pad * 2 - 20 });
  const duaBuf = await sharp(duaPath).toBuffer();
  const duaMeta = await sharp(duaBuf).metadata();
  const duaLeft = cardX + cardW - pad - duaMeta.width;
  const duaTop = cardY + 110;
  const cardH = 110 + duaMeta.height + 40;

  const shadowSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter></defs>
    <rect x="${cardX}" y="${cardY + 14}" width="${cardW}" height="${cardH}" rx="40" fill="rgba(24,20,15,0.16)" filter="url(#b)"/>
  </svg>`;

  const cardSvg = `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${cardW}" height="${cardH}" rx="40" fill="#FFFFFF"/>
  </svg>`;

  const latinTextSvg = `<svg width="${cardW}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${pad + 64 + 16}" y="${pad + 44}" font-family="Plus Jakarta Sans" font-weight="800" font-size="32" fill="#18140F">${appName}</text>
    <text x="${cardW - pad}" y="${pad + 44}" font-family="Nunito" font-weight="600" font-size="26" fill="#8C8778" text-anchor="end">${timestampLabel}</text>
  </svg>`;

  const srcImg = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rawda-lockscreen-src-')), 'src.png');
  await sharp(Buffer.from(bgSvg))
    .composite([
      { input: Buffer.from(clockSvg), top: 0, left: 0 },
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

module.exports = buildLockscreenMockup;
