# PostHog History API Tracking Demo

This repository demonstrates the History API tracking feature in PostHog JS Lite, which allows automatic capture of navigation events in single-page applications (SPAs).

## Overview

Modern web applications often use client-side routing via the History API (`pushState`, `replaceState`) instead of traditional page loads. PostHog can automatically track these navigation events as pageviews when the `trackHistoryEvents` option is enabled.

This demo shows:
- How History API navigation events are captured
- The difference between pushState, replaceState, and popstate events
- How the data is structured in PostHog

## Live Demo

You can try the live demo at [https://lricoy.github.io/test-posthog-history/](https://lricoy.github.io/test-posthog-history/)

## How It Works

The demo includes:

1. **pushState navigation** - Creates a new history entry (Page 1 and Page 2)
2. **replaceState navigation** - Replaces the current history entry (Page 3)
3. **popstate navigation** - Browser back/forward buttons 

Each navigation method is captured as a `$pageview` event with a `navigation_type` property indicating which type of navigation occurred.

## Implementation Details

This feature is implemented in PostHog JS Lite by:

1. Overriding the `window.history.pushState` and `window.history.replaceState` methods
2. Adding an event listener for `popstate` events
3. Capturing each navigation as a `$pageview` event with appropriate properties

## Usage in Your Projects

To enable this feature in your PostHog JS Lite implementation:

```javascript
import { PostHog } from 'posthog-js-lite';

const posthog = new PostHog('<your-api-key>', {
  api_host: 'https://app.posthog.com',
  trackHistoryEvents: true  // Enable History API tracking
});
```

## Running Locally

1. Clone this repository
2. Run `npm install` (if needed)
3. Run `npm start`
4. Open your browser to the displayed URL (usually http://localhost:8080)

## Benefits

- **Complete user journey analytics**: Capture navigation in SPAs
- **Zero manual instrumentation**: No need to call `capture('$pageview')` on route changes  
- **Framework agnostic**: Works with React, Vue, Angular, or any JS framework
- **Lightweight implementation**: Minimal overhead to your application

## License

MIT 