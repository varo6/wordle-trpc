# Cookie-Based Save System Documentation

## Overview

The word game now implements a cookie-based save system that automatically preserves game state until the daily word changes at 00:00 Madrid time. This ensures players can close their browser and return to continue their game within the same day.

## How It Works

### Backend Integration

The system leverages the `timeToEpoch` TRPC endpoint that returns minutes until the next daily word rotation:

```typescript
// Returns integer minutes until next 00:00 Madrid time
word.timeToEpoch.query() // e.g., 743 minutes
```

### Cookie Management

Game state is stored in browser cookies with automatic expiration:

- **Cookie Name**: `wordleGameState`
- **Expiration**: Set to `timeToEpoch` minutes (automatically expires when new word becomes available)
- **Additional Flag**: `wordleHasSavedGame` for quick existence checks

### Saved Game State

The following game state is preserved:

```typescript
interface GameState {
  currentRow: number;                    // Current guess row (0-5)
  gameBoard: Array<Array<{              // Complete board state
    letter: string;
    status: "ok" | "almost" | "no" | null;
  }>>;
  keyStatus: Record<string, "ok" | "almost" | "no" | undefined>; // Keyboard coloring
  gameOver: boolean;                     // Game completion status
  currentGuess: string;                  // In-progress guess
  lastSaved: number;                     // Timestamp for debugging
}
```

## User Experience

### Automatic Save
- Game state is automatically saved after every action (letter input, word submission)
- No manual save required
- Saves only when there's actual progress (currentRow > 0 or keyStatus has entries)

### Automatic Load
- When visiting `/words`, automatically checks for saved game
- If found, restores complete game state
- Shows notification: "GAME_RESTORED: Previous session loaded from cache"

### Visual Indicators
- **Status Bar**: Shows time until next word (e.g., "NEXT_WORD_IN: 12h 23m")
- **Restoration Notice**: Green banner when saved game is loaded
- **Clear Option**: Button to manually clear saved game and start fresh

### Automatic Cleanup
- Cookies expire automatically when new word becomes available
- Game completion (win/loss) immediately clears saved state
- Navigation to result page clears saved state
- Manual clear option available

## API Endpoints Used

### Primary Endpoints
- `word.timeToEpoch` - Gets minutes until next daily word
- `word.tryWord` - Submits word guess (existing functionality)

### Optional/Debug Endpoints
- `word.getTodaysWord` - Gets current word (for debugging)
- `word.clearCache` - Clears server-side word cache

## Implementation Details

### Cookie Utilities (`/lib/cookies.ts`)

```typescript
// Save game with automatic expiration
saveGameState(gameState, minutesToEpoch)

// Load saved game (returns null if none/expired)
loadGameState(): GameState | null

// Check if saved game exists
hasSavedGame(): boolean

// Clear saved game manually
clearGameState()
```

### Error Handling
- Invalid cookie data is automatically cleared
- Missing properties in saved state trigger cleanup
- Malformed JSON gracefully handled
- Fallback to fresh game state on any errors

### Performance Optimizations
- Saves only when necessary (game has progress)
- Efficient cookie size (only essential state)
- Quick existence checks before parsing
- Automatic cleanup prevents cookie bloat

## Security Considerations

- **No Sensitive Data**: Only game state stored, no personal information
- **SameSite=Lax**: Protects against CSRF attacks
- **Path Scoped**: Cookies only accessible within app
- **Auto-Expiring**: No persistent tracking data

## Browser Compatibility

- Works in all modern browsers
- Graceful degradation if cookies disabled
- No external dependencies
- Uses standard Web APIs only

## Development/Debug Features

### Manual Controls
- "CLEAR_SAVE" button to reset saved game
- Console logging for save/load operations
- Validation of saved state structure

### Test Scenarios
```javascript
// Check if game is saved
hasSavedGame()

// View current saved state
loadGameState()

// Manually clear (for testing)
clearGameState()
```

## Benefits

1. **Seamless Experience**: Players can continue games across browser sessions
2. **No Account Required**: Works without user registration/login
3. **Privacy Friendly**: Data stays in user's browser
4. **Automatic Cleanup**: No manual maintenance required
5. **Daily Reset**: Fresh start with each new word
6. **Fast Loading**: Instant game restoration

## Future Enhancements

Potential improvements:
- Offline support with Service Workers
- Multiple save slots
- Export/import save data
- Save statistics/streaks
- Sync across devices (would require accounts)
