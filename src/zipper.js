/**
 * zipper.js
 * ZIP creation for Expo icon assets using JSZip.
 */

import JSZip from 'jszip';

/**
 * Create a ZIP file containing all generated assets.
 * Assets are placed under assets/images/ to match Expo project structure.
 * @param {Array<{name: string, blob: Blob}>} assets - generated PNG assets
 * @returns {Promise<Blob>} - the ZIP file as a Blob
 */
export async function createZip(assets) {
  const zip = new JSZip();
  const folder = zip.folder('assets').folder('images');

  for (const asset of assets) {
    folder.file(asset.name, asset.blob);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return blob;
}

/**
 * Trigger a download of a Blob as a file.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
