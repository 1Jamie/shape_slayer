# Tests

Automated test suite for Shape Slayer. 
Honestly not much yet, just used it for sorting out issues with damage numbers so far.

## Setup

Install dependencies:

```bash
cd tests
npm install
```

Or install from project root:

```bash
npm install --save-dev puppeteer
```

## Running Tests

### Damage Number Sync Test

Tests the multiplayer damage number synchronization flow:

```bash
node tests/damage-numbers.test.js
```

This test:
1. Starts the multiplayer server
2. Launches two headless browsers (host and client)
3. Creates a lobby and connects both players
4. Starts the game
5. Simulates damage on the host
6. Verifies the damage number is sent, received, created, and rendered on the client
7. Reports test results with detailed logs

**Debug Mode**: The test automatically enables `DebugFlags.DAMAGE_NUMBERS` to get verbose logging.

### Expected Output

When tests pass, you'll see:
```
✓ Host sent damage_number event
✓ Client received damage_number event  
✓ Client created damage number
✓ Damage number rendered on client
✓ ALL TESTS PASSED
```

## Debug Flags

The game has toggleable debug flags for verbose logging. In the browser console:

```javascript
// Enable damage number debug logging
DebugFlags.DAMAGE_NUMBERS = true

// Or use the helper method
DebugFlags.enable('DAMAGE_NUMBERS')

// Disable
DebugFlags.DAMAGE_NUMBERS = false
DebugFlags.disable('DAMAGE_NUMBERS')
```

When `DAMAGE_NUMBERS` is enabled, you'll see detailed logs:
- `[Host/Melee]` - Host sending damage from melee attacks
- `[Host/Projectile]` - Host sending damage from projectiles
- `[Host]` - Host processing remote player damage
- `[Client]` - Client receiving and processing damage numbers
- `[UI]` - Damage number creation and rendering

## Troubleshooting

**Server doesn't start**: Make sure port 3000 is available, or change `SERVER_PORT` in the test file.

**Puppeteer not installed**: Run `npm install --save-dev puppeteer` from the project root.

**Tests fail**: Check the detailed logs in the test output. Look for:
- Connection errors (WebSocket)
- Missing createDamageNumber function
- Invalid coordinates or damage values
- Enemy ID mismatches

## Adding New Tests

To add a new test:

1. Create a new file in `tests/` (e.g., `tests/my-test.test.js`)
2. Follow the same structure as `damage-numbers.test.js`
3. Use Puppeteer to automate browser actions
4. Collect and analyze console logs
5. Report results clearly

Example template:

```javascript
const puppeteer = require('puppeteer');

async function myTest() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Your test logic here
    
    await browser.close();
}

if (require.main === module) {
    myTest().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
```


