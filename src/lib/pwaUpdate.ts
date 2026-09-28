import { registerSW } from 'virtual:pwa-register'
import { onResume } from './resume'

// registerType 'autoUpdate': once a new service worker takes control, the page reloads on the new version.
// The browser only looks for a new version on navigation, which never happens while an installed PWA
// stays alive in the background, so also look for one each time the app comes back to the foreground.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) onResume(() => void registration.update().catch(() => {}))
  },
})
