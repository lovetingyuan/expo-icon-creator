/**
 * config.js
 * Generate an app.json configuration snippet for Expo projects.
 */

/**
 * Generate the app.json snippet as a formatted JSON string.
 * @param {string} bgColor - hex background color
 * @param {Object} [darkMode] - dark mode options
 * @param {boolean} darkMode.enabled - whether dark mode is enabled
 * @param {string} darkMode.bgColor - dark mode background color
 * @param {Object} [platforms] - selected platforms
 * @param {boolean} platforms.ios - whether iOS is selected
 * @param {boolean} platforms.android - whether Android is selected
 * @returns {string}
 */
export function generateConfigSnippet(bgColor, darkMode, platforms) {
  const includeIos = !platforms || platforms.ios;
  const includeAndroid = !platforms || platforms.android;

  const splashConfig = {
    image: './assets/images/splash-icon.png',
    imageWidth: 180,
    resizeMode: 'contain',
    backgroundColor: bgColor,
  };

  if (darkMode && darkMode.enabled) {
    splashConfig.dark = {
      image: './assets/images/splash-icon-dark.png',
      backgroundColor: darkMode.bgColor,
    };
  }

  const config = {
    expo: {
      // Universal icon — used for app store listings on both platforms
      icon: './assets/images/icon.png',
    },
  };

  if (includeAndroid) {
    config.expo.android = {
      adaptiveIcon: {
        backgroundColor: bgColor,
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
    };
  }

  config.expo.web = {
    favicon: './assets/images/favicon.png',
  };

  config.expo.plugins = [['expo-splash-screen', splashConfig]];

  return JSON.stringify(config, null, 2);
}
