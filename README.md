# Trello Extension

A Chrome extension that adds some UI tweaks.

## Features

- **Interactive Hashtag Labels**: Transforms #hashtags in your cards into colored labels
- **Customizable Colors**: Click any label to customize its color
- **Label Renaming**: Rename a hashtag across all cards in the board at once
- **Persistent Changes**: All changes are saved to Trello's database
- **Instant Visual Feedback**: See changes immediately while they're being applied
- **No API Keys Required**: Works entirely through the browser interface

## How It Works

The extension uses a hybrid approach to balance user experience and reliability:

1. **Visual Updates**: When you make changes, they appear immediately in the UI
2. **Persistent Updates**: Changes are saved to Trello by simulating user interaction with Trello's native editing interface
3. **Progress Tracking**: A small indicator shows real-time progress of updates

## Technical Implementation

- Uses DOM manipulation for immediate visual updates
- Detects and works with both the quick editor and card back editor interfaces
- Applies updates sequentially to prevent conflicts
- Shows detailed progress with success/failure counts
- Gracefully falls back to visual-only updates if persistent changes fail

## Browser Requirements

- Chrome 88 or later
- Storage permission for saving color preferences
