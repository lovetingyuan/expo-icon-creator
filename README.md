# Expo Icon Creator

A simple, fast, and secure web-based tool to generate all the necessary icon and splash screen assets for your Expo projects from a single SVG file.

**Live Demo:** [https://expo-icon-creator.tingyuan.in](https://expo-icon-creator.tingyuan.in)

## Features

- 🚀 **One-Click Generation**: Generate iOS, Android, and Web icons in seconds.
- 🎨 **Customizable**: Choose background colors and adjust icon padding.
- 🌓 **Dark Mode Support**: Generate dark mode splash screens easily.
- 🤖 **Auto-Padding**: Automatically calculates the optimal padding based on your SVG content.
- 🔒 **Privacy Focused**: All processing is done locally in your browser. Your SVGs are never uploaded to any server.
- 📝 **App Config Snippet**: Get a ready-to-use configuration snippet for your `app.json` or `app.config.js`.

## How to Use

1. **Upload SVG**: Drag and drop your SVG icon or click to upload.
2. **Customize**:
   - Set the background color for your icons and splash screen.
   - Adjust the icon padding (use **Auto Padding** for the best result).
   - Toggle Dark Mode if you need a dark splash screen.
   - Select your target platforms (iOS/Android).
3. **Download**: Click "Generate & Download ZIP" to get your assets.
4. **Configure**: Copy the generated configuration snippet into your Expo project's `app.json`.

## Local Development

This project is built with [Vite](https://vitejs.dev/) and is designed to be deployed on [Cloudflare Pages](https://pages.cloudflare.com/).

### Prerequisites

- Node.js (v18 or later)
- npm

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Deployment

The project uses `wrangler` for deployment to Cloudflare:

```bash
# Deploy to Cloudflare
npm run deploy
```

## License

MIT
