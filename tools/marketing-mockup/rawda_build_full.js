const sharp = require('sharp');
const TextToSVG = require('text-to-svg');

// 6.9" class, one of the 3 sizes Apple currently accepts for the required iPhone
// App Store screenshot set (1320x2868 / 1290x2796 / 1260x2736) - using the largest
// since Apple scales down for smaller display classes automatically.
const CANVAS_W = 1320;
const CANVAS_H = 2868;
// All the layout constants below were tuned against a 1179-wide canvas; scale them
// instead of re-tuning by hand so the proportions (and the look already approved)
// stay identical at the new size.
const SCALE = CANVAS_W / 1179;
const path = require('path');
const HEADLINE_FONT = path.join(__dirname, 'fonts', 'PlusJakartaSans_800ExtraBold.ttf');
const FONT_SEMI = path.join(__dirname, 'fonts', 'Nunito_600SemiBold.ttf');

async function build({
  srcImg, out, line1, line2,
  textColor = '#2E2A22',
  bgTop = '#F2EADA', bgMid = '#F5EFE2', bgBottom = '#FAF6EE',
  frameColor = '#fbfaf7', frameStroke = '#B9A27A', frameStrokeWidth = Math.round(6 * SCALE),
  bezel = Math.round(28 * SCALE), cropTop = Math.round(110 * SCALE), cropBottom = Math.round(46 * SCALE), safeArea = Math.round(90 * SCALE),
  showIsland = true, showStatusIcons = false,
  iconColor = '#18140F', statusBg = { r: 250, g: 246, b: 237 },
  phoneSideMargin = Math.round(70 * SCALE), phoneTopMargin = Math.round(580 * SCALE), headlineTopY = Math.round(220 * SCALE),
}) {
  const headlineToSVG = TextToSVG.loadSync(HEADLINE_FONT);
  const textToSVGSemi = TextToSVG.loadSync(FONT_SEMI);

  const phoneW = CANVAS_W - phoneSideMargin * 2, phoneH = Math.round(2100 * SCALE);
  const phoneX = (CANVAS_W - phoneW) / 2;
  const phoneY = phoneTopMargin;
  const screenW = phoneW - bezel * 2;
  const screenH = phoneH - bezel * 2;
  const screenRadius = Math.round(108 * SCALE);
  const phoneRadius = Math.round(132 * SCALE);

  const bgSvg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bgTop}"/>
        <stop offset="55%" stop-color="${bgMid}"/>
        <stop offset="100%" stop-color="${bgBottom}"/>
      </linearGradient>
    </defs>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg)"/>
  </svg>`;

  let fontSize = Math.round(85 * SCALE);
  const maxLineWidth = CANVAS_W - Math.round(110 * SCALE);
  for (const line of [line1, line2]) {
    if (!line) continue;
    const m = headlineToSVG.getMetrics(line, { fontSize });
    if (m.width > maxLineWidth) fontSize = Math.min(fontSize, fontSize * maxLineWidth / m.width);
  }
  const opts = { x: CANVAS_W / 2, fontSize, anchor: 'top center' };
  const topY = headlineTopY;
  const p1 = headlineToSVG.getD(line1, { ...opts, y: topY });
  const p2 = line2 ? headlineToSVG.getD(line2, { ...opts, y: topY + fontSize * 1.28 }) : '';
  const textSvg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg"><path d="${p1}" fill="${textColor}"/>${p2 ? `<path d="${p2}" fill="${textColor}"/>` : ''}</svg>`;

  const shadowPad = Math.round(50 * SCALE);
  const shadowBlur = Math.round(30 * SCALE);
  const shadowSvg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${shadowBlur}"/></filter></defs><rect x="${phoneX - shadowPad / 2}" y="${phoneY - shadowPad / 2 + 14}" width="${phoneW + shadowPad}" height="${phoneH + shadowPad}" rx="${phoneRadius + Math.round(20 * SCALE)}" fill="rgba(40,34,24,0.28)" filter="url(#blur)"/></svg>`;

  const phoneSvg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg"><rect x="${phoneX}" y="${phoneY}" width="${phoneW}" height="${phoneH}" rx="${phoneRadius}" fill="${frameColor}" stroke="${frameStroke}" stroke-width="${frameStrokeWidth}"/></svg>`;

  const sx = phoneX + bezel, sy = phoneY + bezel;
  const statusMidY = sy + safeArea / 2 + 6;
  const timeD = textToSVGSemi.getD('9:41', { x: sx + 50, y: statusMidY, fontSize: 36, anchor: 'left middle' });

  const battW = 40, battH = 19;
  const battRight = sx + screenW - 36;
  const battX = battRight - battW - 4;
  const battY = statusMidY - battH / 2;
  const battery = `<rect x="${battX}" y="${battY}" width="${battW}" height="${battH}" rx="5" fill="none" stroke="${iconColor}" stroke-width="3"/><rect x="${battX + 3}" y="${battY + 3}" width="${battW - 8}" height="${battH - 6}" rx="2" fill="${iconColor}"/><rect x="${battX + battW + 3}" y="${battY + 5}" width="4" height="${battH - 10}" rx="1.5" fill="${iconColor}"/>`;

  const wifiCx = battX - 36, wifiCy = statusMidY + 2;
  const wifi = `<path d="M ${wifiCx-14} ${wifiCy-3} A 20 20 0 0 1 ${wifiCx+14} ${wifiCy-3}" stroke="${iconColor}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M ${wifiCx-8} ${wifiCy+4} A 12 12 0 0 1 ${wifiCx+8} ${wifiCy+4}" stroke="${iconColor}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="${wifiCx}" cy="${wifiCy+9}" r="2.6" fill="${iconColor}"/>`;

  const barW = 7, barGap = 4;
  const barHeights = [11, 15, 19, 23];
  const barsRightEdge = wifiCx - 22;
  let bars = '';
  barHeights.forEach((h, i) => {
    const x = barsRightEdge - (barHeights.length - i) * (barW + barGap);
    bars += `<rect x="${x}" y="${statusMidY - h/2 + 5}" width="${barW}" height="${h}" rx="2" fill="${iconColor}"/>`;
  });

  const homeIndicatorW = Math.round(170 * SCALE), homeIndicatorH = Math.round(7 * SCALE);
  const homeIndicatorSvg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg"><rect x="${phoneX + phoneW/2 - homeIndicatorW/2}" y="${phoneY + phoneH - bezel - Math.round(20 * SCALE)}" width="${homeIndicatorW}" height="${homeIndicatorH}" rx="${homeIndicatorH/2}" fill="${iconColor}" fill-opacity="0.5"/></svg>`;

  const statusBarSvg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg"><path d="${timeD}" fill="${iconColor}"/>${battery}${wifi}${bars}</svg>`;

  const islandW = Math.round(196 * SCALE), islandH = Math.round(56 * SCALE);
  const islandSvg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg"><rect x="${CANVAS_W/2 - islandW/2}" y="${sy + safeArea/2 - islandH/2 + 6}" width="${islandW}" height="${islandH}" rx="${Math.round(28 * SCALE)}" fill="#000000"/></svg>`;

  const screenMaskSvg = `<svg width="${screenW}" height="${screenH}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${screenW}" height="${screenH}" rx="${screenRadius}" fill="#ffffff"/></svg>`;

  const meta = await sharp(srcImg).metadata();
  const cropped = sharp(srcImg).extract({ left: 0, top: cropTop, width: meta.width, height: meta.height - cropTop - cropBottom });

  const contentH = screenH - safeArea;
  // No dark scrim here - it was only needed to keep *white* status-bar icons legible over
  // busy/light content; with dark iconColor (Rawda's light-themed app) it would just reduce
  // contrast against the already-light background instead.
  const contentResized = await cropped.resize(screenW, contentH, { fit: 'cover', position: 'top' }).toBuffer();

  const screenComposed = await sharp({ create: { width: screenW, height: screenH, channels: 3, background: statusBg } })
    .composite([{ input: contentResized, left: 0, top: safeArea }])
    .png()
    .toBuffer();

  const maskedScreen = await sharp(screenComposed)
    .composite([{ input: Buffer.from(screenMaskSvg), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const layers = [
    { input: Buffer.from(shadowSvg), left: 0, top: 0 },
    { input: Buffer.from(phoneSvg), left: 0, top: 0 },
    { input: maskedScreen, left: Math.round(phoneX + bezel), top: Math.round(phoneY + bezel) },
  ];
  if (showStatusIcons) layers.push({ input: Buffer.from(statusBarSvg), left: 0, top: 0 });
  if (showIsland) layers.push({ input: Buffer.from(islandSvg), left: 0, top: 0 });
  layers.push({ input: Buffer.from(homeIndicatorSvg), left: 0, top: 0 });
  layers.push({ input: Buffer.from(textSvg), left: 0, top: 0 });

  await sharp(Buffer.from(bgSvg)).composite(layers).png().toFile(out);
  console.log('Wrote', out);
}

module.exports = build;
