'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 1024;
const COLORS = Object.freeze({
  blue: '#1d4ed8',
  blueAccent: '#2563eb',
  white: '#ffffff',
  slate: '#0f172a',
});

function hexToRgba(hex, alpha = 255) {
  const normalized = hex.replace('#', '');

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
    alpha,
  };
}

function createCanvas(background) {
  const canvas = {
    width: SIZE,
    height: SIZE,
    pixels: Buffer.alloc(SIZE * SIZE * 4),
  };

  if (background) {
    fillRect(canvas, 0, 0, SIZE, SIZE, hexToRgba(background));
  }

  return canvas;
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
    return;
  }

  const offset = (y * canvas.width + x) * 4;
  canvas.pixels[offset] = color.red;
  canvas.pixels[offset + 1] = color.green;
  canvas.pixels[offset + 2] = color.blue;
  canvas.pixels[offset + 3] = color.alpha;
}

function fillRect(canvas, x, y, width, height, color) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(canvas.width, Math.ceil(x + width));
  const bottom = Math.min(canvas.height, Math.ceil(y + height));

  for (let currentY = top; currentY < bottom; currentY += 1) {
    for (let currentX = left; currentX < right; currentX += 1) {
      setPixel(canvas, currentX, currentY, color);
    }
  }
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  if (safeRadius === 0) {
    fillRect(canvas, x, y, width, height, color);
    return;
  }

  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(canvas.width, Math.ceil(x + width));
  const bottom = Math.min(canvas.height, Math.ceil(y + height));
  const innerLeft = x + safeRadius;
  const innerRight = x + width - safeRadius;
  const innerTop = y + safeRadius;
  const innerBottom = y + height - safeRadius;
  const radiusSquared = safeRadius * safeRadius;

  for (let currentY = top; currentY < bottom; currentY += 1) {
    for (let currentX = left; currentX < right; currentX += 1) {
      const pointX = currentX + 0.5;
      const pointY = currentY + 0.5;
      const nearestX = Math.max(innerLeft, Math.min(pointX, innerRight));
      const nearestY = Math.max(innerTop, Math.min(pointY, innerBottom));
      const deltaX = pointX - nearestX;
      const deltaY = pointY - nearestY;

      if (deltaX * deltaX + deltaY * deltaY <= radiusSquared) {
        setPixel(canvas, currentX, currentY, color);
      }
    }
  }
}

function fillCircle(canvas, centerX, centerY, radius, color) {
  const radiusSquared = radius * radius;
  const left = Math.max(0, Math.floor(centerX - radius));
  const top = Math.max(0, Math.floor(centerY - radius));
  const right = Math.min(canvas.width, Math.ceil(centerX + radius));
  const bottom = Math.min(canvas.height, Math.ceil(centerY + radius));

  for (let currentY = top; currentY < bottom; currentY += 1) {
    for (let currentX = left; currentX < right; currentX += 1) {
      const deltaX = currentX + 0.5 - centerX;
      const deltaY = currentY + 0.5 - centerY;

      if (deltaX * deltaX + deltaY * deltaY <= radiusSquared) {
        setPixel(canvas, currentX, currentY, color);
      }
    }
  }
}

function strokeSegment(canvas, startX, startY, endX, endY, thickness, color) {
  const radius = thickness / 2;
  const minX = Math.max(0, Math.floor(Math.min(startX, endX) - radius));
  const minY = Math.max(0, Math.floor(Math.min(startY, endY) - radius));
  const maxX = Math.min(canvas.width, Math.ceil(Math.max(startX, endX) + radius));
  const maxY = Math.min(canvas.height, Math.ceil(Math.max(startY, endY) + radius));
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;
  const radiusSquared = radius * radius;

  for (let currentY = minY; currentY < maxY; currentY += 1) {
    for (let currentX = minX; currentX < maxX; currentX += 1) {
      const pointX = currentX + 0.5;
      const pointY = currentY + 0.5;
      const projection =
        segmentLengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / segmentLengthSquared
              )
            );
      const nearestX = startX + projection * deltaX;
      const nearestY = startY + projection * deltaY;
      const offsetX = pointX - nearestX;
      const offsetY = pointY - nearestY;

      if (offsetX * offsetX + offsetY * offsetY <= radiusSquared) {
        setPixel(canvas, currentX, currentY, color);
      }
    }
  }
}

function drawCalendarMark(canvas, scale) {
  const blue = hexToRgba(COLORS.blue);
  const accent = hexToRgba(COLORS.blueAccent);
  const white = hexToRgba(COLORS.white);
  const width = 620 * scale;
  const height = 560 * scale;
  const left = (SIZE - width) / 2;
  const top = (SIZE - height) / 2 + 24 * scale;
  const radius = 84 * scale;

  fillRoundedRect(canvas, left, top, width, height, radius, blue);
  fillRoundedRect(canvas, left, top, width, 176 * scale, radius, accent);
  fillRoundedRect(
    canvas,
    left + 58 * scale,
    top + 188 * scale,
    width - 116 * scale,
    height - 246 * scale,
    44 * scale,
    white
  );

  fillRoundedRect(canvas, left + 142 * scale, top - 42 * scale, 56 * scale, 112 * scale, 28 * scale, white);
  fillRoundedRect(canvas, left + width - 198 * scale, top - 42 * scale, 56 * scale, 112 * scale, 28 * scale, white);
  fillCircle(canvas, left + 170 * scale, top + 14 * scale, 15 * scale, blue);
  fillCircle(canvas, left + width - 170 * scale, top + 14 * scale, 15 * scale, blue);

  const checkStartX = left + 168 * scale;
  const checkStartY = top + 394 * scale;
  const checkMiddleX = left + 265 * scale;
  const checkMiddleY = top + 474 * scale;
  const checkEndX = left + 455 * scale;
  const checkEndY = top + 292 * scale;

  strokeSegment(canvas, checkStartX, checkStartY, checkMiddleX, checkMiddleY, 42 * scale, blue);
  strokeSegment(canvas, checkMiddleX, checkMiddleY, checkEndX, checkEndY, 42 * scale, blue);
  fillCircle(canvas, left + 152 * scale, top + 252 * scale, 12 * scale, accent);
  fillCircle(canvas, left + 468 * scale, top + 474 * scale, 12 * scale, accent);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const value of buffer) {
    crc ^= value;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));

  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function writePng(filePath, canvas) {
  const rowLength = canvas.width * 4;
  const raw = Buffer.alloc((rowLength + 1) * canvas.height);

  for (let row = 0; row < canvas.height; row += 1) {
    const targetOffset = row * (rowLength + 1);
    raw[targetOffset] = 0;
    canvas.pixels.copy(raw, targetOffset + 1, row * rowLength, (row + 1) * rowLength);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk('IHDR', header),
    createChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
}

function generateAssets() {
  const assetsDirectory = path.resolve(__dirname, '..', 'assets');
  fs.mkdirSync(assetsDirectory, { recursive: true });

  const icon = createCanvas(COLORS.white);
  drawCalendarMark(icon, 1.1);
  writePng(path.join(assetsDirectory, 'icon.png'), icon);

  const adaptiveIcon = createCanvas();
  drawCalendarMark(adaptiveIcon, 0.96);
  writePng(path.join(assetsDirectory, 'adaptive-icon.png'), adaptiveIcon);

  const splashIcon = createCanvas();
  drawCalendarMark(splashIcon, 1.16);
  writePng(path.join(assetsDirectory, 'splash-icon.png'), splashIcon);

  console.log('Generated icon.png, adaptive-icon.png, and splash-icon.png (1024x1024 PNG).');
}

generateAssets();
