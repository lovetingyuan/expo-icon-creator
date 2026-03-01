/**
 * main.js
 * App initialization, SVG upload handling, event binding, and preview rendering.
 */

import './style.css';
import {
  loadSvgAsImage,
  generateAllAssets,
  renderPreview,
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

// ---- DOM Elements ----
const uploadZone = document.getElementById('upload-zone');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const uploadPreview = document.getElementById('upload-preview');
const svgPreviewImg = document.getElementById('svg-preview-img');
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
const iconPaddingSlider = document.getElementById('icon-padding');
const paddingValueLabel = document.getElementById('padding-value');
const btnAutoPadding = document.getElementById('btn-auto-padding');

let isAutoPadding = false; // tracks whether the current value was auto-calculated

const btnGenerate = document.getElementById('btn-generate');

const previewEmpty = document.getElementById('preview-empty');
const previewGrid = document.getElementById('preview-grid');
const previewIos = document.getElementById('preview-ios');
const previewAndroid = document.getElementById('preview-android');
const previewSplash = document.getElementById('preview-splash');
const previewFavicon = document.getElementById('preview-favicon');
const previewMono = document.getElementById('preview-mono');
const previewSplashDark = document.getElementById('preview-splash-dark');
const previewSplashDarkCard = document.getElementById('preview-splash-dark-card');

const configSection = document.getElementById('config-section');
const configCode = document.getElementById('config-code');
const btnCopy = document.getElementById('btn-copy');

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

function getPadding() {
  return parseInt(iconPaddingSlider.value, 10);
}

function updateGenerateButton() {
  btnGenerate.disabled = !svgImage;
}

function showUploadedSvg() {
  if (svgPreviewUrl) URL.revokeObjectURL(svgPreviewUrl);
  uploadPlaceholder.style.display = 'none';
  uploadPreview.style.display = 'flex';
  svgPreviewUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  svgPreviewImg.src = svgPreviewUrl;
}

function clearUploadedSvg() {
  svgText = null;
  svgImage = null;
  if (svgPreviewUrl) {
    URL.revokeObjectURL(svgPreviewUrl);
    svgPreviewUrl = null;
  }
  uploadPlaceholder.style.display = 'flex';
  uploadPreview.style.display = 'none';
  svgPreviewImg.src = '';
  fileInput.value = '';
  updateGenerateButton();
  hidePreview();
  resetPaddingToDefault();
  configSection.style.display = 'none';
}

function resetPaddingToDefault() {
  iconPaddingSlider.value = 20;
  isAutoPadding = false;
  updatePaddingLabel();
}

function updatePaddingLabel() {
  const val = iconPaddingSlider.value + '%';
  if (isAutoPadding) {
    paddingValueLabel.textContent = val;
    paddingValueLabel.classList.add('auto-badge');
  } else {
    paddingValueLabel.textContent = val;
    paddingValueLabel.classList.remove('auto-badge');
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

// ---- Preview Rendering ----
function renderAllPreviews() {
  if (!svgImage) return;

  try {
    const bgColor = getBgColor();
    const padding = getPadding() / 100;
    const platforms = getSelectedPlatforms();

    // iOS icon preview (icon.png is always generated as universal store icon)
    const iosCard = previewIos.closest('.preview-card');
    renderPreview(previewIos, svgImage, bgColor, padding);
    iosCard.style.display = 'flex';

    // Android adaptive icon preview (foreground on background)
    const androidCard = previewAndroid.closest('.preview-card');
    if (platforms.android) {
      renderPreview(previewAndroid, svgImage, bgColor, padding, { circularSafeZone: true });
      androidCard.style.display = 'flex';
    } else {
      androidCard.style.display = 'none';
    }

    // Splash screen preview (shared by both platforms)
    const splashCard = previewSplash.closest('.preview-card');
    if (platforms.ios || platforms.android) {
      renderPreview(previewSplash, svgImage, bgColor, padding, { splashScale: 0.3 });
      splashCard.style.display = 'flex';
    } else {
      splashCard.style.display = 'none';
    }

    // Dark mode splash screen preview
    if (isDarkModeEnabled() && (platforms.ios || platforms.android)) {
      const darkBgColor = getDarkBgColor();
      renderPreview(previewSplashDark, svgImage, darkBgColor, padding, { splashScale: 0.3 });
      previewSplashDarkCard.style.display = 'flex';
    } else {
      previewSplashDarkCard.style.display = 'none';
    }

    // Favicon preview (web, always shown if any platform selected)
    const faviconCard = previewFavicon.closest('.preview-card');
    if (platforms.ios || platforms.android) {
      renderPreview(previewFavicon, svgImage, bgColor, padding * 0.6);
      faviconCard.style.display = 'flex';
    } else {
      faviconCard.style.display = 'none';
    }

    // Monochrome preview (Android only)
    const monoCard = previewMono.closest('.preview-card');
    if (platforms.android) {
      renderPreview(previewMono, svgImage, null, padding, { monochrome: true, circularSafeZone: true });
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

// ---- Event: Color Picker ----
bgColorPicker.addEventListener('input', () => {
  bgColorText.value = bgColorPicker.value;
  renderAllPreviews();
  updateConfigSnippet();
});

bgColorText.addEventListener('input', () => {
  let val = bgColorText.value.trim();
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    bgColorPicker.value = val;
    renderAllPreviews();
    updateConfigSnippet();
  }
});

bgColorText.addEventListener('blur', () => {
  bgColorText.value = bgColorPicker.value;
});

// ---- Event: Dark Mode Toggle ----
darkModeToggle.addEventListener('change', () => {
  darkModeOptions.style.display = darkModeToggle.checked ? 'flex' : 'none';
  renderAllPreviews();
  updateConfigSnippet();
});

darkBgColorPicker.addEventListener('input', () => {
  darkBgColorText.value = darkBgColorPicker.value;
  renderAllPreviews();
  updateConfigSnippet();
});

darkBgColorText.addEventListener('input', () => {
  let val = darkBgColorText.value.trim();
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    darkBgColorPicker.value = val;
    renderAllPreviews();
    updateConfigSnippet();
  }
});

darkBgColorText.addEventListener('blur', () => {
  darkBgColorText.value = darkBgColorPicker.value;
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

// ---- Event: Auto Padding Button ----
btnAutoPadding.addEventListener('click', () => {
  applyAutoPadding();
});

// ---- Event: Generate & Download ----
btnGenerate.addEventListener('click', async () => {
  if (!svgImage) return;

  const originalText = btnGenerate.textContent;
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
    const assets = await generateAllAssets(svgImage, getBgColor(), getPadding(), darkMode, platforms);
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
