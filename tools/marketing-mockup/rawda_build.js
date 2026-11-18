const sharp = require('sharp');
const TextToSVG = require('text-to-svg');

const CANVAS_W = 1179;
const CANVAS_H = 2556;
const path = require('path');
const HEADLINE_FONT = path.join(__dirname, 'fonts', 'PlusJakartaSans_800ExtraBold.ttf');

async function build({ srcImg, out, line1, line2, textColor = '#3A332C', bg = '#EDE4D3', frameColor = '#141210', bezel = 16 }) {
  const headlineToSVG = TextToSVG.loadSync(HEADLINE_FONT);

  const phoneW = 1139, phoneH = 2100;
  const phoneX = (CANVAS_W - phoneW) / 2;
  const phoneY = 650;
  const screenW = phoneW - bezel * 2;
  const screenH = phoneH - bezel * 2;
  const screenRadius = 36;
  const phoneRadius = 50;

  const bgSvg = `
  <svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${bg}"/>
  </svg>`;

  let fontSize = 85;
  const maxLineWidth = CANVAS_W - 110;
  for (const line of [line1, line2]) {
    if (!line) continue;
    const m = headlineToSVG.getMetrics(line, { fontSize });
    if (m.width > maxLineWidth) fontSize = Math.min(fontSize, fontSize * maxLineWidth / m.width);
  }
  const opts = { x: CANVAS_W / 2, fontSize, anchor: 'top center' };
  const topY = 320;
  const p1 = headlineToSVG.getD(line1, { ...opts, y: topY });
  const p2 = line2 ? headlineToSVG.getD(line2, { ...opts, y: topY + fontSize * 1.28 }) : '';
  const textSvg = `
  <svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <path d="${p1}" fill="${textColor}"/>
    ${p2 ? `<path d="${p2}" fill="${textColor}"/>` : ''}
  </svg>`;

  const shadowPad = 50;
  const shadowSvg = `
  <svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="30"/>
      </filter>
    </defs>
    <rect x="${phoneX - shadowPad / 2}" y="${phoneY - shadowPad / 2 + 14}" width="${phoneW + shadowPad}" height="${phoneH + shadowPad}" rx="${phoneRadius + 20}" fill="rgba(40,34,24,0.28)" filter="url(#blur)"/>
  </svg>`;

  const phoneSvg = `
  <svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${phoneX}" y="${phoneY}" width="${phoneW}" height="${phoneH}" rx="${phoneRadius}" fill="${frameColor}"/>
  </svg>`;

  const screenMaskSvg = `
  <svg width="${screenW}" height="${screenH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${screenW}" height="${screenH}" rx="${screenRadius}" fill="#ffffff"/>
  </svg>`;

  const resized = await sharp(srcImg)
    .resize(screenW, screenH, { fit: 'fill' })
    .toBuffer();

  const maskedScreen = await sharp(resized)
    .composite([{ input: Buffer.from(screenMaskSvg), blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp(Buffer.from(bgSvg))
    .composite([
      { input: Buffer.from(shadowSvg), left: 0, top: 0 },
      { input: Buffer.from(phoneSvg), left: 0, top: 0 },
      { input: maskedScreen, left: Math.round(phoneX + bezel), top: Math.round(phoneY + bezel) },
      { input: Buffer.from(textSvg), left: 0, top: 0 },
    ])
    .png()
    .toFile(out);

  console.log('Wrote', out);
}

module.exports = build;
