/**
 * Vercel Speed Insights initialization
 * This script imports and initializes the Speed Insights package
 */
import { injectSpeedInsights } from './node_modules/@vercel/speed-insights/dist/index.mjs';

// Initialize Speed Insights
// The injectSpeedInsights function will only track in production
// In development, it loads a debug version of the script
injectSpeedInsights({
  debug: false, // Set to true to enable debug logging in development
});
