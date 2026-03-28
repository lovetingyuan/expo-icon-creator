/**
 * main.js
 * App initialization, SVG upload handling, event binding, and preview rendering.
 */

import './style.css';
import {
  loadSvgAsImage,
  generateAllAssets,
  renderPreview,
  renderSplashPreview,
  analyzeContentBounds,
  calculateOptimalPadding,
} from './generator.js';
import { createZip, downloadBlob } from './zipper.js';
import { generateConfigSnippet } from './config.js';

// ---- Global Error Handling ----
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  showToast('An unexpected error occurred. Please try again.', 5000);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showToast('An unexpected error occurred. Please try again.', 5000);
});

// ---- State ----
let svgText = null;
let svgImage = null;
let svgPreviewUrl = null;
let svgDimensions = null;

// ---- DOM Elements ----
const uploadZone = document.getElementById('upload-zone');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const uploadPreview = document.getElementById('upload-preview');
const svgPreviewImg = document.getElementById('svg-preview-img');
const svgDimensionsValue = document.getElementById('svg-dimensions');
const fileInput = document.getElementById('file-input');
const btnRemove = document.getElementById('btn-remove');

const platformIos = document.getElementById('platform-ios');
const platformAndroid = document.getElementById('platform-android');

const bgColorPicker = document.getElementById('bg-color');
const bgColorText = document.getElementById('bg-color-text');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const darkModeOptions = document.getElementById('dark-mode-options');
const darkBgColorPicker = document.getElementById('dark-bg-color');
const darkBgColorText = document.getElementById('dark-bg-color-text');
const darkSplashTextColorPicker = document.getElementById('dark-splash-text-color');
const darkSplashTextColorText = document.getElementById('dark-splash-text-color-text');
const iconPaddingSlider = document.getElementById('icon-padding');
const iconPaddingValueLabel = document.getElementById('icon-padding-value');
const splashPaddingSlider = document.getElementById('splash-padding');
const splashPaddingValueLabel = document.getElementById('splash-padding-value');
const splashTextInput = document.getElementById('splash-text');
const splashTextSizeSlider = document.getElementById('splash-text-size');
const splashTextSizeValueLabel = document.getElementById('splash-text-size-value');
const splashTextColorPicker = document.getElementById('splash-text-color');
const splashTextColorText = document.getElementById('splash-text-color-text');
const btnAutoPadding = document.getElementById('btn-auto-padding');

let isAutoPadding = false; // tracks whether the current value was auto-calculated

const btnGenerate = document.getElementById('btn-generate');

const previewEmpty = document.getElementById('preview-empty');
const previewGrid = document.getElementById('preview-grid');
const previewIos = document.getElementById('preview-ios');
const previewAndroid = document.getElementById('preview-android');
const previewSplash = document.getElementById('preview-splash');
const previewHomeScene = document.getElementById('preview-home-scene');
const previewHomeSceneDesc = document.getElementById('preview-home-scene-desc');
const previewHomeVariants = document.getElementById('preview-home-variants');
const previewHomeVariantIos = document.getElementById('preview-home-variant-ios');
const previewHomeVariantRounded = document.getElementById('preview-home-variant-rounded');
const previewHomeVariantCircle = document.getElementById('preview-home-variant-circle');
const previewHomeIconIos = document.getElementById('preview-home-icon-ios');
const previewHomeIconRounded = document.getElementById('preview-home-icon-rounded');
const previewHomeIconCircle = document.getElementById('preview-home-icon-circle');
const previewHomeSearch = document.getElementById('preview-home-search');
const previewLaunch = document.getElementById('preview-launch');
const previewLaunchDark = document.getElementById('preview-launch-dark');
const previewLaunchDarkCard = document.getElementById('preview-launch-dark-card');
const previewFavicon = document.getElementById('preview-favicon');
const previewMono = document.getElementById('preview-mono');
const previewSplashDark = document.getElementById('preview-splash-dark');
const previewSplashDarkCard = document.getElementById('preview-splash-dark-card');

const configSection = document.getElementById('config-section');
const configDesc = document.getElementById('config-desc');
const configCode = document.getElementById('config-code');
const btnCopy = document.getElementById('btn-copy');

const MAX_SPLASH_TEXT_CHARS = 10;

// ---- Helpers ----
function getSelectedPlatforms() {
  return {
    ios: platformIos.checked,
    android: platformAndroid.checked,
  };
}

function getBgColor() {
  return bgColorPicker.value;
}

function isDarkModeEnabled() {
  return darkModeToggle.checked;
}

function getDarkBgColor() {
  return darkBgColorPicker.value;
}

function getIconPadding() {
  return parseInt(iconPaddingSlider.value, 10);
}

function getSplashPadding() {
  return parseInt(splashPaddingSlider.value, 10);
}

function getSplashText() {
  return splashTextInput.value.trim();
}

function getSplashTextSize() {
  return parseInt(splashTextSizeSlider.value, 10);
}

function getSplashTextColor() {
  return splashTextColorPicker.value;
}

function getDarkSplashTextColor() {
  return darkSplashTextColorPicker.value;
}

function getSplashTextOptions() {
  return {
    text: getSplashText(),
    sizePercent: getSplashTextSize(),
    color: getSplashTextColor(),
    darkColor: getDarkSplashTextColor(),
  };
}

function updateGenerateButton() {
  btnGenerate.disabled = !svgImage;
}

function clampSplashText(value) {
  return Array.from(value).slice(0, MAX_SPLASH_TEXT_CHARS).join('');
}

function getInputValueWithInsertedText(input, insertedText) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  return input.value.slice(0, start) + insertedText + input.value.slice(end);
}

function replaceSelectedText(input, nextText) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText(nextText, start, end, 'end');
}

function enforceSplashTextLimit(value, showLimitToast = false) {
  const clamped = clampSplashText(value);
  if (clamped !== value && showLimitToast) {
    showToast(`Splash text supports up to ${MAX_SPLASH_TEXT_CHARS} characters.`, 3000);
  }
  if (splashTextInput.value !== clamped) {
    splashTextInput.value = clamped;
  }
  return clamped;
}

function showUploadedSvg() {
  if (svgPreviewUrl) URL.revokeObjectURL(svgPreviewUrl);
  uploadPlaceholder.style.display = 'none';
  uploadPreview.style.display = 'flex';
  svgPreviewUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  svgPreviewImg.src = svgPreviewUrl;
  svgDimensionsValue.textContent = formatSvgDimensions(svgDimensions);
}

function clearUploadedSvg() {
  svgText = null;
  svgImage = null;
  svgDimensions = null;
  if (svgPreviewUrl) {
    URL.revokeObjectURL(svgPreviewUrl);
    svgPreviewUrl = null;
  }
  uploadPlaceholder.style.display = 'flex';
  uploadPreview.style.display = 'none';
  svgPreviewImg.src = '';
  svgDimensionsValue.textContent = '-';
  fileInput.value = '';
  updateGenerateButton();
  hidePreview();
  resetPaddingToDefault();
  configSection.style.display = 'none';
}

function resetPaddingToDefault() {
  iconPaddingSlider.value = 20;
  splashPaddingSlider.value = 12;
  splashTextSizeSlider.value = 9;
  isAutoPadding = false;
  updatePaddingLabel();
}

function updatePaddingLabel() {
  const val = iconPaddingSlider.value + '%';
  splashPaddingValueLabel.textContent = splashPaddingSlider.value + '%';
  splashTextSizeValueLabel.textContent = splashTextSizeSlider.value + '%';
  if (isAutoPadding) {
    iconPaddingValueLabel.textContent = val;
    iconPaddingValueLabel.classList.add('auto-badge');
  } else {
    iconPaddingValueLabel.textContent = val;
    iconPaddingValueLabel.classList.remove('auto-badge');
  }
}

function applyAutoPadding() {
  if (!svgImage) return;
  const bounds = analyzeContentBounds(svgImage);
  const optimal = calculateOptimalPadding(bounds);
  iconPaddingSlider.value = optimal;
  isAutoPadding = true;
  updatePaddingLabel();
  renderAllPreviews();
}

function showPreview() {
  previewEmpty.style.display = 'none';
  previewGrid.style.display = 'grid';
}

function hidePreview() {
  previewEmpty.style.display = 'flex';
  previewGrid.style.display = 'none';
}

const MAX_SVG_SIZE_BYTES = 2 * 1024 * 1024;

function isLikelySvgFile(file) {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return mime === 'image/svg+xml' || mime.includes('svg') || name.endsWith('.svg');
}

function validateSvgFile(file) {
  if (!file) {
    return 'No file selected.';
  }

  if (!isLikelySvgFile(file)) {
    return 'Please upload an SVG file (.svg).';
  }

  if (file.size <= 0) {
    return 'The selected file is empty.';
  }

  if (file.size > MAX_SVG_SIZE_BYTES) {
    return 'SVG is too large. Maximum allowed size is 2MB.';
  }

  return null;
}

function parseNumericSvgLength(value) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized || normalized.endsWith('%')) return null;

  const match = normalized.match(/^([+-]?\d*\.?\d+)(px)?$/i);
  if (!match) return null;

  const parsed = parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSvgDimensions(svgMarkup) {
  if (!svgMarkup) return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
    const svg = doc.documentElement;

    if (svg.tagName !== 'svg') return null;

    const width = parseNumericSvgLength(svg.getAttribute('width'));
    const height = parseNumericSvgLength(svg.getAttribute('height'));
    if (width && height) {
      return { width, height };
    }

    const viewBox = (svg.getAttribute('viewBox') || '').trim();
    if (!viewBox) return null;

    const parts = viewBox
      .split(/[\s,]+/)
      .map((part) => parseFloat(part))
      .filter((part) => Number.isFinite(part));

    if (parts.length !== 4) return null;

    const [, , viewBoxWidth, viewBoxHeight] = parts;
    if (viewBoxWidth > 0 && viewBoxHeight > 0) {
      return { width: viewBoxWidth, height: viewBoxHeight };
    }
  } catch (err) {
    console.warn('Failed to parse SVG dimensions:', err);
  }

  return null;
}

function formatSvgDimension(value) {
  if (!Number.isFinite(value)) return '?';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function formatSvgDimensions(dimensions) {
  if (!dimensions) return 'Unknown';
  return `${formatSvgDimension(dimensions.width)} x ${formatSvgDimension(dimensions.height)}`;
}

function isUnsafeExternalReference(value) {
  if (!value) return false;
  const raw = value.trim();
  if (!raw) return false;

  if (raw.startsWith('#')) return false;

  const lowered = raw.toLowerCase();
  if (lowered.startsWith('javascript:')) return true;
  if (lowered.startsWith('http:') || lowered.startsWith('https:') || lowered.startsWith('//')) return true;
  if (lowered.startsWith('data:') || lowered.startsWith('blob:')) return true;

  return true;
}

function hasUnsafeCss(value) {
  if (!value) return false;
  const lowered = value.toLowerCase();
  if (lowered.includes('@import')) return true;
  if (lowered.includes('expression(')) return true;

  const urlMatches = lowered.match(/url\(([^)]*)\)/g);
  if (!urlMatches) return false;

  for (const match of urlMatches) {
    const inner = match
      .slice(4, -1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!inner || inner.startsWith('#')) continue;
    return true;
  }

  return false;
}

const ADAPTIVE_ICON_LAYER_DP = 108;
const ADAPTIVE_ICON_SAFE_ZONE_DP = 66;
const PIXEL_SQUIRCLE_EXPONENT = 5.5;

function createSuperellipsePath(x, y, size, exponent = PIXEL_SQUIRCLE_EXPONENT, steps = 80) {
  const path = new Path2D();
  const radius = size / 2;
  const centerX = x + radius;
  const centerY = y + radius;

  for (let i = 0; i <= steps; i += 1) {
    const angle = (Math.PI * 2 * i) / steps;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pointX =
      centerX + radius * Math.sign(cos) * Math.pow(Math.abs(cos), 2 / exponent);
    const pointY =
      centerY + radius * Math.sign(sin) * Math.pow(Math.abs(sin), 2 / exponent);

    if (i === 0) {
      path.moveTo(pointX, pointY);
    } else {
      path.lineTo(pointX, pointY);
    }
  }

  path.closePath();
  return path;
}

function createCirclePath(x, y, size) {
  const path = new Path2D();
  path.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  path.closePath();
  return path;
}

function renderAdaptiveHomeIcon(canvas, image, bgColor, padding, maskType = 'rounded') {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const size = Math.min(width, height);
  const offsetX = (width - size) / 2;
  const offsetY = (height - size) / 2;
  const safeZoneRatio = ADAPTIVE_ICON_SAFE_ZONE_DP / ADAPTIVE_ICON_LAYER_DP;
  const safeZoneSize = size * safeZoneRatio;
  const contentSize = safeZoneSize * Math.max(0.1, 1 - 2 * padding);
  const iconX = (width - contentSize) / 2;
  const iconY = (height - contentSize) / 2;
  const maskInset = 1;
  const maskPath =
    maskType === 'circle'
      ? createCirclePath(offsetX + maskInset, offsetY + maskInset, size - maskInset * 2)
      : createSuperellipsePath(offsetX + maskInset, offsetY + maskInset, size - maskInset * 2);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.clip(maskPath);
  ctx.fillStyle = bgColor;
  ctx.fillRect(offsetX, offsetY, size, size);
  ctx.drawImage(image, iconX, iconY, contentSize, contentSize);
  ctx.restore();
}

// ---- Preview Rendering ----
function renderAllPreviews() {
  if (!svgImage) return;

  try {
    const bgColor = getBgColor();
    const iconPadding = getIconPadding() / 100;
    const splashPadding = getSplashPadding() / 100;
    const splashText = getSplashTextOptions();
    const platforms = getSelectedPlatforms();
    const useAndroidHomeStyle = platforms.android;

    // iOS icon preview (icon.png is always generated as universal store icon)
    const iosCard = previewIos.closest('.preview-card');
    renderPreview(previewIos, svgImage, bgColor, iconPadding);
    iosCard.style.display = 'flex';

    // Android adaptive icon preview (foreground on background)
    const androidCard = previewAndroid.closest('.preview-card');
    if (platforms.android) {
      renderPreview(previewAndroid, svgImage, bgColor, iconPadding, { circularSafeZone: true });
      androidCard.style.display = 'flex';
    } else {
      androidCard.style.display = 'none';
    }

    // Splash screen preview (shared by both platforms)
    const splashCard = previewSplash.closest('.preview-card');
    if (platforms.ios || platforms.android) {
      renderSplashPreview(previewSplash, svgImage, bgColor, splashPadding, {
        splashScale: 0.42,
        text: splashText.text,
        textSizePercent: splashText.sizePercent,
        textColor: splashText.color,
      });
      splashCard.style.display = 'flex';
    } else {
      splashCard.style.display = 'none';
    }

    // Dark mode splash screen preview
    if (isDarkModeEnabled() && (platforms.ios || platforms.android)) {
      const darkBgColor = getDarkBgColor();
      renderSplashPreview(previewSplashDark, svgImage, darkBgColor, splashPadding, {
        splashScale: 0.42,
        text: splashText.text,
        textSizePercent: splashText.sizePercent,
        textColor: splashText.darkColor,
      });
      previewSplashDarkCard.style.display = 'flex';
    } else {
      previewSplashDarkCard.style.display = 'none';
    }

    // Home screen scene preview
    const homeSceneCard = previewHomeScene.closest('.preview-card');
    if (platforms.ios || platforms.android) {
      previewHomeScene.classList.toggle('scene-android', useAndroidHomeStyle);
      previewHomeScene.classList.toggle('scene-ios', !useAndroidHomeStyle);
      previewHomeVariants.classList.toggle('scene-icon-variants-android', useAndroidHomeStyle);
      previewHomeVariants.classList.toggle('scene-icon-variants-ios', !useAndroidHomeStyle);
      previewHomeSearch.style.display = useAndroidHomeStyle ? 'flex' : 'none';
      previewHomeSceneDesc.textContent = useAndroidHomeStyle
        ? 'Adaptive icon masks on launcher: rounded and circle'
        : 'Following iPhone home screen style';
      if (useAndroidHomeStyle) {
        previewHomeVariantIos.style.display = 'none';
        previewHomeVariantRounded.style.display = 'flex';
        previewHomeVariantCircle.style.display = 'flex';
        renderAdaptiveHomeIcon(previewHomeIconRounded, svgImage, bgColor, iconPadding, 'rounded');
        renderAdaptiveHomeIcon(previewHomeIconCircle, svgImage, bgColor, iconPadding, 'circle');
      } else {
        previewHomeVariantIos.style.display = 'flex';
        previewHomeVariantRounded.style.display = 'none';
        previewHomeVariantCircle.style.display = 'none';
        renderPreview(previewHomeIconIos, svgImage, bgColor, iconPadding);
      }
      homeSceneCard.style.display = 'flex';
    } else {
      homeSceneCard.style.display = 'none';
    }

    // Launch scene preview
    const launchCard = previewLaunch.closest('.preview-card');
    if (platforms.ios || platforms.android) {
      renderSplashPreview(previewLaunch, svgImage, bgColor, splashPadding, {
        splashScale: 0.52,
        text: splashText.text,
        textSizePercent: splashText.sizePercent,
        textColor: splashText.color,
      });
      launchCard.style.display = 'flex';
    } else {
      launchCard.style.display = 'none';
    }

    if (isDarkModeEnabled() && (platforms.ios || platforms.android)) {
      renderSplashPreview(previewLaunchDark, svgImage, getDarkBgColor(), splashPadding, {
        splashScale: 0.52,
        text: splashText.text,
        textSizePercent: splashText.sizePercent,
        textColor: splashText.darkColor,
      });
      previewLaunchDarkCard.style.display = 'flex';
    } else {
      previewLaunchDarkCard.style.display = 'none';
    }

    // Favicon preview (web, always shown if any platform selected)
    const faviconCard = previewFavicon.closest('.preview-card');
    if (platforms.ios || platforms.android) {
      renderPreview(previewFavicon, svgImage, bgColor, iconPadding * 0.6);
      faviconCard.style.display = 'flex';
    } else {
      faviconCard.style.display = 'none';
    }

    // Monochrome preview (Android only)
    const monoCard = previewMono.closest('.preview-card');
    if (platforms.android) {
      renderPreview(previewMono, svgImage, null, iconPadding, {
        monochrome: true,
        circularSafeZone: true,
      });
      monoCard.style.display = 'flex';
    } else {
      monoCard.style.display = 'none';
    }

    showPreview();
  } catch (err) {
    console.error('Preview rendering failed:', err);
  }
}

// ---- SVG Sanitization ----
/**
 * Sanitize SVG content by removing potentially dangerous elements and attributes.
 * Strips <script>, <foreignObject>, event handlers (on*), and external resource references.
 */
function sanitizeSvg(rawSvgText) {
  if (typeof rawSvgText !== 'string' || !rawSvgText.trim()) {
    throw new Error('Invalid SVG: empty content');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvgText, 'image/svg+xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid SVG: XML parsing failed');
  }

  const svg = doc.documentElement;
  if (svg.tagName !== 'svg') {
    throw new Error('Invalid SVG: root element is not <svg>');
  }

  // Dangerous elements to remove
  const dangerousTags = [
    'script',
    'foreignObject',
    'iframe',
    'object',
    'embed',
    'audio',
    'video',
    'canvas',
    'link',
    'meta',
    'base',
  ];
  for (const selector of dangerousTags) {
    const elements = svg.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  }

  const styleTags = svg.querySelectorAll('style');
  styleTags.forEach((styleEl) => {
    const cssText = styleEl.textContent || '';
    if (hasUnsafeCss(cssText)) {
      styleEl.remove();
    }
  });

  // Remove all event handler attributes (on*) and external references
  const allElements = svg.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      // Remove event handlers
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }

      if (name === 'style' && hasUnsafeCss(attr.value)) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (['href', 'xlink:href', 'src'].includes(name) && isUnsafeExternalReference(attr.value)) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (name.endsWith(':href') && isUnsafeExternalReference(attr.value)) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (
        (name === 'filter' || name === 'mask' || name === 'clip-path' || name === 'fill' || name === 'stroke') &&
        /url\(([^)]*)\)/i.test(attr.value)
      ) {
        const match = attr.value.match(/url\(([^)]*)\)/i);
        const inner = match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
        if (isUnsafeExternalReference(inner)) {
          el.removeAttribute(attr.name);
        }
      }
    }
  });

  return new XMLSerializer().serializeToString(svg);
}

// ---- SVG Loading ----
async function handleSvgFile(file) {
  const validationError = validateSvgFile(file);
  if (validationError) {
    showToast(validationError, 4500);
    return;
  }

  let text;
  try {
    text = await file.text();
    text = sanitizeSvg(text);
  } catch (err) {
    console.error('SVG validation failed:', err);
    showToast('Invalid SVG file. Please upload a valid SVG.', 4000);
    return;
  }
  svgText = text;
  svgDimensions = parseSvgDimensions(text);

  try {
    svgImage = await loadSvgAsImage(text);
  } catch (err) {
    console.error('Failed to load SVG:', err);
    alert('Failed to load SVG file. Please check the file is a valid SVG.');
    clearUploadedSvg();
    return;
  }

  showUploadedSvg();
  updateGenerateButton();
  applyAutoPadding();
  updateConfigSnippet();
}

// ---- Config ----
function updateConfigSnippet() {
  if (!svgImage) {
    configSection.style.display = 'none';
    return;
  }
  const darkMode = {
    enabled: isDarkModeEnabled(),
    bgColor: getDarkBgColor(),
  };
  const platforms = getSelectedPlatforms();
  const snippet = generateConfigSnippet(getBgColor(), darkMode, platforms);
  configDesc.textContent = getSplashText()
    ? "Copy and merge this into your Expo project's app.json. Splash text is already baked into the generated splash images:"
    : "Copy and merge this into your Expo project's app.json:";
  configCode.textContent = snippet;
  configSection.style.display = 'block';
}

// ---- Event: Upload Zone ----
uploadZone.addEventListener('click', (e) => {
  if (e.target.closest('.btn-remove')) return;
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleSvgFile(file);
});

// Drag & Drop
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleSvgFile(file);
});

// Remove button
btnRemove.addEventListener('click', (e) => {
  e.stopPropagation();
  clearUploadedSvg();
});

function bindHexColorInput(colorPicker, colorTextInput, onChange) {
  colorPicker.addEventListener('input', () => {
    colorTextInput.value = colorPicker.value;
    onChange();
  });

  colorTextInput.addEventListener('input', () => {
    let val = colorTextInput.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      colorPicker.value = val;
      onChange();
    }
  });

  colorTextInput.addEventListener('blur', () => {
    colorTextInput.value = colorPicker.value;
  });
}

function handleSplashTextChanged() {
  renderAllPreviews();
  updateConfigSnippet();
}

// ---- Event: Color Picker ----
bindHexColorInput(bgColorPicker, bgColorText, () => {
  renderAllPreviews();
  updateConfigSnippet();
});

// ---- Event: Dark Mode Toggle ----
darkModeToggle.addEventListener('change', () => {
  darkModeOptions.style.display = darkModeToggle.checked ? 'flex' : 'none';
  renderAllPreviews();
  updateConfigSnippet();
});

bindHexColorInput(darkBgColorPicker, darkBgColorText, () => {
  renderAllPreviews();
  updateConfigSnippet();
});

bindHexColorInput(splashTextColorPicker, splashTextColorText, handleSplashTextChanged);
bindHexColorInput(darkSplashTextColorPicker, darkSplashTextColorText, handleSplashTextChanged);

splashTextInput.addEventListener('beforeinput', (event) => {
  if (
    event.inputType.startsWith('delete') ||
    event.inputType.startsWith('history') ||
    event.inputType === 'insertCompositionText'
  ) {
    return;
  }

  const insertedText = event.data ?? '';
  if (!insertedText) return;

  const nextValue = getInputValueWithInsertedText(splashTextInput, insertedText);
  if (Array.from(nextValue).length > MAX_SPLASH_TEXT_CHARS) {
    event.preventDefault();
    showToast(`Splash text supports up to ${MAX_SPLASH_TEXT_CHARS} characters.`, 3000);
  }
});

splashTextInput.addEventListener('paste', (event) => {
  const pastedText = event.clipboardData?.getData('text') || '';
  if (!pastedText) return;

  const nextValue = getInputValueWithInsertedText(splashTextInput, pastedText);
  if (Array.from(nextValue).length <= MAX_SPLASH_TEXT_CHARS) return;

  event.preventDefault();

  const currentValue =
    splashTextInput.value.slice(0, splashTextInput.selectionStart ?? splashTextInput.value.length) +
    splashTextInput.value.slice(splashTextInput.selectionEnd ?? splashTextInput.value.length);
  const remaining = Math.max(0, MAX_SPLASH_TEXT_CHARS - Array.from(currentValue).length);
  const truncatedPaste = Array.from(pastedText).slice(0, remaining).join('');

  replaceSelectedText(splashTextInput, truncatedPaste);
  handleSplashTextChanged();
  showToast(`Splash text supports up to ${MAX_SPLASH_TEXT_CHARS} characters.`, 3000);
});

splashTextInput.addEventListener('input', () => {
  enforceSplashTextLimit(splashTextInput.value, true);
  handleSplashTextChanged();
});

// ---- Event: Platform Selection ----
platformIos.addEventListener('change', () => {
  // Ensure at least one platform is selected
  if (!platformIos.checked && !platformAndroid.checked) {
    platformIos.checked = true;
    return;
  }
  renderAllPreviews();
  updateConfigSnippet();
});

platformAndroid.addEventListener('change', () => {
  // Ensure at least one platform is selected
  if (!platformIos.checked && !platformAndroid.checked) {
    platformAndroid.checked = true;
    return;
  }
  renderAllPreviews();
  updateConfigSnippet();
});

// ---- Event: Padding Slider ----
iconPaddingSlider.addEventListener('input', () => {
  isAutoPadding = false;
  updatePaddingLabel();
  renderAllPreviews();
});

splashPaddingSlider.addEventListener('input', () => {
  updatePaddingLabel();
  renderAllPreviews();
});

splashTextSizeSlider.addEventListener('input', () => {
  updatePaddingLabel();
  renderAllPreviews();
});

// ---- Event: Auto Padding Button ----
btnAutoPadding.addEventListener('click', () => {
  applyAutoPadding();
});

// ---- Event: Generate & Download ----
btnGenerate.addEventListener('click', async () => {
  if (!svgImage) return;

  btnGenerate.classList.add('generating');
  btnGenerate.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Generating...
  `;

  try {
    const darkMode = {
      enabled: isDarkModeEnabled(),
      bgColor: getDarkBgColor(),
    };
    const platforms = getSelectedPlatforms();
    const assets = await generateAllAssets(
      svgImage,
      getBgColor(),
      {
        iconPaddingPercent: getIconPadding(),
        splashPaddingPercent: getSplashPadding(),
      },
      darkMode,
      platforms,
      getSplashTextOptions()
    );
    const zipBlob = await createZip(assets);

    // Build descriptive filename
    const platformParts = [];
    if (platforms.ios) platformParts.push('ios');
    if (platforms.android) platformParts.push('android');
    const platformSuffix = platformParts.length === 2 ? '' : `-${platformParts.join('-')}`;
    downloadBlob(zipBlob, `expo-icons${platformSuffix}.zip`);
    showToast('Assets generated and downloaded successfully!');
  } catch (err) {
    console.error('Generation failed:', err);
    showToast('Failed to generate assets. Please try again.', 5000);
  } finally {
    btnGenerate.classList.remove('generating');
    btnGenerate.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Generate & Download ZIP
    `;
  }
});

// ---- Event: Copy Config ----
btnCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(configCode.textContent);
    btnCopy.textContent = 'Copied!';
    btnCopy.classList.add('copied');
    setTimeout(() => {
      btnCopy.textContent = 'Copy';
      btnCopy.classList.remove('copied');
    }, 2000);
  } catch {
    // Fallback: select and copy
    const range = document.createRange();
    range.selectNodeContents(configCode);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    sel.removeAllRanges();
    btnCopy.textContent = 'Copied!';
    btnCopy.classList.add('copied');
    setTimeout(() => {
      btnCopy.textContent = 'Copy';
      btnCopy.classList.remove('copied');
    }, 2000);
  }
});

// ---- Toast Notification ----
function showToast(message, duration = 3000) {
  // Remove existing toast if any
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}

// ---- Spinner animation via CSS ----
const spinStyle = document.createElement('style');
spinStyle.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }
`;
document.head.appendChild(spinStyle);

// ---- Init ----
updateGenerateButton();
