let isPolyfilled = false;

/**
 * Lazily initializes @napi-rs/canvas polyfills on globalThis (Path2D, DOMMatrix, ImageData)
 * needed exclusively by pdfjs-dist / pdf-to-png-converter during timetable PDF rendering.
 *
 * Keeping this out of main.ts saves 1.5 - 3.5 seconds of synchronous native addon loading
 * during application startup.
 */
export function ensureCanvasPolyfills(): void {
  if (isPolyfilled) {
    return;
  }

  try {
    const rootCanvas = require(
      require('path').join(
        process.cwd(),
        'node_modules/pdf-to-png-converter/node_modules/@napi-rs/canvas',
      ),
    );

    for (const className of ['Path2D', 'DOMMatrix', 'ImageData']) {
      if (!(className in globalThis)) {
        Object.defineProperty(globalThis, className, {
          get() {
            return rootCanvas[className];
          },
          set() {
            // Ignore setting to prevent older module versions from overwriting
          },
          configurable: false,
        });
      }
    }
    isPolyfilled = true;
  } catch {
    // Fallback: If canvas path differs or already present, continue gracefully
  }
}

