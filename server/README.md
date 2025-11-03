# Shape Slayer Multiplayer Server

WebSocket-based multiplayer server for Shape Slayer game lobbies.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on port 4000 by default.

## Configuration

- **Port**: 4000 (WebSocket server)
- **Max Players per Lobby**: 4
- **Lobby Code Length**: 6 characters (alphanumeric)

## Server Features

- **Lobby Management**: Create and join lobbies with 6-character codes
- **Host Authority**: First player in lobby is host, controls game state
- **Host Migration**: If host disconnects, next player becomes host
- **Message Relay**: Relays game state from host to clients
- **Automatic Cleanup**: Removes lobbies older than 1 hour

## WebSocket Messages

### Client -> Server

#### Create Lobby
```json
{
  "type": "create_lobby",
  "data": {
    "playerName": "Player1",
    "class": "square"
  }
}
```

#### Join Lobby
```json
{
  "type": "join_lobby",
  "data": {
    "code": "A3X9K2",
    "playerName": "Player2",
    "playerClass": "hexagon"
  }
}
```

#### Leave Lobby
```json
{
  "type": "leave_lobby"
}
```

#### Game State (Host only)
```json
{
  "type": "game_state",
  "data": {
    "players": [...],
    "enemies": [...],
    "projectiles": [...],
    "roomNumber": 5
  }
}
```

#### Player State (Clients)
```json
{
  "type": "player_state",
  "data": {
    "id": "player-123",
    "x": 100,
    "y": 200,
    "hp": 80,
    "rotation": 1.57
  }
}
```

### Server -> Client

#### Lobby Created
```json
{
  "type": "lobby_created",
  "data": {
    "code": "A3X9K2",
    "playerId": "player-123",
    "isHost": true,
    "players": [...]
  }
}
```

#### Lobby Joined
```json
{
  "type": "lobby_joined",
  "data": {
    "code": "A3X9K2",
    "playerId": "player-456",
    "isHost": false,
    "players": [...]
  }
}
```

#### Player Joined/Left
```json
{
  "type": "player_joined",
  "data": {
    "player": {...},
    "players": [...]
  }
}
```

## Production Deployment

For production, consider:
- Using environment variables for configuration
- Adding SSL/TLS support (wss://)
- Implementing rate limiting
- Adding authentication/authorization
- Using a reverse proxy (nginx)
- Monitoring and logging

## Environment Variables

You can customize the server with environment variables:

```bash
PORT=4000 npm start
```

## Troubleshooting

- **Port already in use**: Change the PORT in mp-server.js or use PORT environment variable
- **Connection refused**: Make sure the server is running and firewall allows port 4000
- **Lobby not found**: Lobby codes are case-sensitive and expire after 1 hour







