/**
 * generator.js
 * Canvas-based PNG generation for all Expo asset types.
 */

/**
 * Normalize an SVG string so that its intrinsic rasterization size is large
 * enough for high-quality output. Browsers rasterize <img>-loaded SVGs at the
 * SVG's intrinsic dimensions before canvas drawImage scales them, so a small
 * intrinsic size (e.g. 24×24) would produce blurry results when drawn onto a
 * 1024×1024 canvas.
 *
 * Strategy:
 * - Parse the SVG and ensure it has a viewBox.
 * - Set width/height to a large value (2048) so the browser rasterizes at
 *   high resolution. The viewBox preserves the original aspect ratio.
 *
 * @param {string} svgText - raw SVG markup
 * @returns {string} - normalized SVG markup
 */
function normalizeSvgSize(svgText) {
  const TARGET_SIZE = 2048;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;

    // If parsing failed, return original
    if (svg.tagName !== 'svg') return svgText;

    // Ensure viewBox exists
    if (!svg.getAttribute('viewBox')) {
      const w = parseFloat(svg.getAttribute('width')) || TARGET_SIZE;
      const h = parseFloat(svg.getAttribute('height')) || TARGET_SIZE;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    // Override width/height to ensure high-res rasterization
    svg.setAttribute('width', String(TARGET_SIZE));
    svg.setAttribute('height', String(TARGET_SIZE));

    return new XMLSerializer().serializeToString(svg);
  } catch {
    // If anything goes wrong, return original
    return svgText;
  }
}

/**
 * Load an SVG string as an Image element via data URI.
 * The SVG is first normalized to a large intrinsic size so browsers
 * rasterize it at high resolution before canvas scaling.
 * Returns a Promise<HTMLImageElement>.
 */
export function loadSvgAsImage(svgText) {
  const normalizedSvg = normalizeSvgSize(svgText);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([normalizedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };
    img.src = url;
  });
}

/**
 * Draw an icon centered on a canvas with the given options.
 * @param {Object} opts
 * @param {HTMLCanvasElement} opts.canvas - target canvas (already sized)
 * @param {HTMLImageElement} opts.image - the SVG loaded as Image
 * @param {string|null} opts.bgColor - background color hex, or null for transparent
 * @param {number} opts.padding - padding ratio (0-1), e.g. 0.2 for 20%
 * @param {boolean} opts.monochrome - if true, render as grayscale
 * @param {boolean} opts.circularSafeZone - if true, use Android adaptive icon safe zone (66.6% of canvas)
 */
function drawIcon(opts) {
  const { canvas, image, bgColor, padding, monochrome, circularSafeZone } = opts;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Background
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  }

  // Calculate icon area
  let iconPadding = padding;
  if (circularSafeZone) {
    // Android adaptive icon: the safe zone is a centered circle with diameter = 66% of the full size.
    // The icon should fit within this safe zone. We apply padding within the safe zone area.
    // Safe zone diameter = 66.6% of canvas → radius = 33.3%
    // Icon fits in a square inscribed in the safe zone circle.
    // inscribed square side = diameter / sqrt(2) ≈ 0.471 of canvas
    // Then apply user padding within that.
    const safeRatio = 0.666;
    const inscribedRatio = safeRatio / Math.SQRT2;
    iconPadding = (1 - inscribedRatio * (1 - padding)) / 2;
  }

  const iconSize = Math.min(w, h) * (1 - 2 * iconPadding);
  const x = (w - iconSize) / 2;
  const y = (h - iconSize) / 2;

  if (monochrome) {
    // Draw to a temporary canvas, then convert to grayscale
    const tmpCanvas = new OffscreenCanvas(w, h);
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(image, x, y, iconSize, iconSize);
    const imageData = tmpCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Convert to luminance
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Monochrome: use black (0) with original alpha
      // For Android monochrome, the icon shape is defined by alpha channel
      // We make opaque pixels fully opaque and dark
      if (data[i + 3] > 0) {
        const gray = Math.round(lum);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
    }
    tmpCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0);
  } else {
    ctx.drawImage(image, x, y, iconSize, iconSize);
  }
}

/**
 * Generate all Expo icon assets as { name, blob } array.
 * @param {HTMLImageElement} svgImage - SVG loaded as Image
 * @param {string} bgColor - hex color string (e.g. "#ffffff")
 * @param {number} paddingPercent - padding percentage (0-45)
 * @param {Object} [darkMode] - dark mode options
 * @param {boolean} darkMode.enabled - whether dark mode is enabled
 * @param {string} darkMode.bgColor - dark mode background color
 * @param {Object} [platforms] - selected platforms
 * @param {boolean} platforms.ios - whether iOS is selected
 * @param {boolean} platforms.android - whether Android is selected
 * @returns {Promise<Array<{name: string, blob: Blob}>>}
 */
export async function generateAllAssets(svgImage, bgColor, paddingPercent, darkMode, platforms) {
  const padding = paddingPercent / 100;
  const splashPadding = Math.min(padding, 0.12);
  const includeIos = !platforms || platforms.ios;
  const includeAndroid = !platforms || platforms.android;

  const assets = [];

  // Universal app icon — Expo uses this for app store listings on both platforms
  // Always generated regardless of platform selection
  assets.push({
    name: 'icon.png',
    size: 1024,
    bgColor: bgColor,
    padding: padding,
    monochrome: false,
    circularSafeZone: false,
  });

  // Android adaptive icon assets
  if (includeAndroid) {
    assets.push(
      {
        name: 'android-icon-foreground.png',
        size: 512,
        bgColor: null, // transparent
        padding: padding,
        monochrome: false,
        circularSafeZone: true,
      },
      {
        name: 'android-icon-background.png',
        size: 512,
        bgColor: bgColor,
        padding: 0,
        monochrome: false,
        circularSafeZone: false,
        bgOnly: true,
      },
      {
        name: 'android-icon-monochrome.png',
        size: 512,
        bgColor: null, // transparent
        padding: padding,
        monochrome: true,
        circularSafeZone: true,
      },
    );
  }

  // Favicon (web — shared)
  if (includeIos || includeAndroid) {
    assets.push({
      name: 'favicon.png',
      size: 48,
      bgColor: bgColor,
      padding: padding * 0.6, // less padding on tiny favicon
      monochrome: false,
      circularSafeZone: false,
    });
  }

  // Splash screen icon (shared)
  if (includeIos || includeAndroid) {
    assets.push({
      name: 'splash-icon.png',
      size: 2048,
      bgColor: null, // transparent; background color is set via config
      padding: splashPadding,
      monochrome: false,
      circularSafeZone: false,
    });
  }

  // Add dark mode splash icon if enabled
  if (darkMode && darkMode.enabled && (includeIos || includeAndroid)) {
    assets.push({
      name: 'splash-icon-dark.png',
      size: 2048,
      bgColor: null, // transparent; dark background color is set via config
      padding: splashPadding,
      monochrome: false,
      circularSafeZone: false,
    });
  }

  const results = [];

  for (const asset of assets) {
    const canvas = new OffscreenCanvas(asset.size, asset.size);

    if (asset.bgOnly) {
      // Background only — just fill with color
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = asset.bgColor;
      ctx.fillRect(0, 0, asset.size, asset.size);
    } else {
      drawIcon({
        canvas,
        image: svgImage,
        bgColor: asset.bgColor,
        padding: asset.padding,
        monochrome: asset.monochrome,
        circularSafeZone: asset.circularSafeZone,
      });
    }

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    results.push({ name: asset.name, blob });
  }

  return results;
}

/**
 * Analyze SVG content bounds by pixel scanning.
 * Renders the SVG on a transparent canvas and scans from each edge
 * (left→right, right→left, top→bottom, bottom→top) to find the first
 * non-transparent pixel, recording the distance from each side.
 *
 * @param {HTMLImageElement} svgImage - SVG loaded as Image
 * @returns {{ left: number, right: number, top: number, bottom: number }}
 *   Padding ratios (0–1) from each side to the first content pixel.
 */
export function analyzeContentBounds(svgImage) {
  const size = 256; // render at this resolution for analysis
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(svgImage, 0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const ALPHA_THRESHOLD = 10; // ignore nearly-transparent pixels

  function getAlpha(x, y) {
    return data[(y * size + x) * 4 + 3];
  }

  // Scan from left: column by column, left → right
  let leftPad = size;
  scanLeft: for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (getAlpha(x, y) > ALPHA_THRESHOLD) {
        leftPad = x;
        break scanLeft;
      }
    }
  }

  // Scan from right: column by column, right → left
  let rightPad = size;
  scanRight: for (let x = size - 1; x >= 0; x--) {
    for (let y = 0; y < size; y++) {
      if (getAlpha(x, y) > ALPHA_THRESHOLD) {
        rightPad = size - 1 - x;
        break scanRight;
      }
    }
  }

  // Scan from top: row by row, top → bottom
  let topPad = size;
  scanTop: for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (getAlpha(x, y) > ALPHA_THRESHOLD) {
        topPad = y;
        break scanTop;
      }
    }
  }

  // Scan from bottom: row by row, bottom → top
  let bottomPad = size;
  scanBottom: for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      if (getAlpha(x, y) > ALPHA_THRESHOLD) {
        bottomPad = size - 1 - y;
        break scanBottom;
      }
    }
  }

  return {
    left: leftPad / size,
    right: rightPad / size,
    top: topPad / size,
    bottom: bottomPad / size,
  };
}

/**
 * Calculate the optimal padding slider value based on the SVG's detected
 * content bounds and Expo's platform requirements.
 *
 * Strategy:
 * - Detect how much "built-in" padding the SVG already has.
 * - For Expo, the total visual padding should be ~16.67% each side
 *   (content occupies 66.67% of the icon), matching Android's adaptive
 *   icon safe-zone diameter (66%) for a consistent cross-platform look.
 * - For iOS, Apple masks the icon — a moderate padding prevents awkward
 *   clipping at the rounded-rect corners.
 * - The formula accounts for the fact that the slider padding is applied
 *   first, then the SVG (with its own padding) is scaled into the
 *   remaining area:
 *     totalPadding = slider + existingPad × (1 − 2 × slider)
 *     ⇒ slider = (TARGET − existingPad) / (1 − 2 × existingPad)
 *
 * @param {{ left: number, right: number, top: number, bottom: number }} bounds
 * @returns {number} Optimal slider value (5–45)
 */
export function calculateOptimalPadding(bounds) {
  // Use the minimum padding across all 4 sides (tightest edge)
  const existingPad = Math.min(bounds.left, bounds.right, bounds.top, bounds.bottom);

  // Target total visual padding per side ≈ 16.67%
  // This makes the content occupy ~66.67% of the icon area, which:
  //  • Aligns with Android adaptive icon safe-zone (66% circle diameter)
  //  • Leaves comfortable room for iOS rounded-rect masking (~17.5% corner radius)
  //  • Produces visually balanced splash screen icons
  const TARGET_PADDING = 0.1667;

  let optimalSlider;

  if (existingPad >= TARGET_PADDING) {
    // SVG already has enough (or more) padding — use minimum slider value
    optimalSlider = 5;
  } else {
    const denom = 1 - 2 * existingPad;
    if (denom <= 0) {
      optimalSlider = 5;
    } else {
      optimalSlider = Math.round(((TARGET_PADDING - existingPad) / denom) * 100);
    }
  }

  // Clamp to slider range [5, 45]
  return Math.max(5, Math.min(45, optimalSlider));
}

/**
 * Render a preview onto a visible canvas element.
 * This is similar to drawIcon but works with visible <canvas> elements.
 */
export function renderPreview(canvas, image, bgColor, padding, opts = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  }

  if (opts.bgOnly) return;

  if (!image) return;

  let iconPadding = padding;
  if (opts.circularSafeZone) {
    const safeRatio = 0.666;
    const inscribedRatio = safeRatio / Math.SQRT2;
    iconPadding = (1 - inscribedRatio * (1 - padding)) / 2;
  }

  // For splash preview, the icon is smaller relative to the canvas
  const scale = opts.splashScale || 1;
  const baseSize = Math.min(w, h);
  const iconSize = baseSize * (1 - 2 * iconPadding) * scale;
  const x = (w - iconSize) / 2;
  const y = (h - iconSize) / 2;

  if (opts.monochrome) {
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = w;
    tmpCanvas.height = h;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(image, x, y, iconSize, iconSize);
    const imageData = tmpCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = lum;
        data[i + 1] = lum;
        data[i + 2] = lum;
      }
    }
    tmpCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0);
  } else {
    ctx.drawImage(image, x, y, iconSize, iconSize);
  }
}
