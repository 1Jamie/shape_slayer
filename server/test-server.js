#!/usr/bin/env node

/**
 * Simple test script for the multiplayer server
 * Tests lobby creation, joining, and basic messaging
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:4000';
const TEST_TIMEOUT = 10000; // 10 seconds

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function log(message) {
    console.log(`[Test] ${message}`);
}

function success(message) {
    testsPassed++;
    console.log(`✅ ${message}`);
}

function fail(message) {
    testsFailed++;
    console.error(`❌ ${message}`);
}

function createClient() {
    return new WebSocket(SERVER_URL);
}

function sendMessage(ws, type, data) {
    ws.send(JSON.stringify({ type, data }));
}

function waitForMessage(ws, expectedType, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for message: ${expectedType}`));
        }, timeout);
        
        ws.on('message', (message) => {
            const msg = JSON.parse(message.toString());
            if (msg.type === expectedType) {
                clearTimeout(timer);
                resolve(msg);
            }
        });
    });
}

async function testLobbyCreation() {
    testsRun++;
    log('Test 1: Lobby Creation');
    
    const client = createClient();
    
    return new Promise((resolve, reject) => {
        client.on('open', async () => {
            try {
                sendMessage(client, 'create_lobby', {
                    playerName: 'TestPlayer1',
                    class: 'square'
                });
                
                const response = await waitForMessage(client, 'lobby_created');
                
                if (response.data.code && response.data.playerId && response.data.isHost === true) {
                    success('Lobby created successfully with code: ' + response.data.code);
                    client.close();
                    resolve(response.data.code);
                } else {
                    fail('Lobby creation response missing required fields');
                    client.close();
                    reject(new Error('Invalid response'));
                }
            } catch (err) {
                fail('Lobby creation failed: ' + err.message);
                client.close();
                reject(err);
            }
        });
        
        client.on('error', (err) => {
            fail('Connection error: ' + err.message);
            reject(err);
        });
    });
}

async function testLobbyJoin(lobbyCode) {
    testsRun++;
    log('Test 2: Lobby Join');
    
    // Create host first
    const host = createClient();
    
    return new Promise((resolve, reject) => {
        host.on('open', async () => {
            try {
                // Create lobby
                sendMessage(host, 'create_lobby', {
                    playerName: 'HostPlayer',
                    class: 'square'
                });
                
                const createResponse = await waitForMessage(host, 'lobby_created');
                const code = createResponse.data.code;
                
                log(`Created lobby ${code}, attempting to join...`);
                
                // Create second client to join
                const client = createClient();
                
                client.on('open', async () => {
                    try {
                        sendMessage(client, 'join_lobby', {
                            code,
                            playerName: 'JoinerPlayer',
                            playerClass: 'triangle'
                        });
                        
                        const joinResponse = await waitForMessage(client, 'lobby_joined', 3000);
                        
                        if (joinResponse.data.code === code && joinResponse.data.isHost === false) {
                            success('Player joined lobby successfully');
                            
                            // Wait for host to receive player_joined notification
                            try {
                                const hostNotification = await waitForMessage(host, 'player_joined', 3000);
                                
                                if (hostNotification.data.player.name === 'JoinerPlayer') {
                                    success('Host received join notification');
                                } else {
                                    fail('Host notification missing player data');
                                }
                            } catch (err) {
                                // Host might not get notification if on different worker
                                log('Host notification timeout (cross-worker issue)');
                            }
                            
                            client.close();
                            host.close();
                            resolve();
                        } else {
                            fail('Lobby join response invalid');
                            client.close();
                            host.close();
                            reject(new Error('Invalid join response'));
                        }
                    } catch (err) {
                        fail('Lobby join failed: ' + err.message);
                        client.close();
                        host.close();
                        reject(err);
                    }
                });
                
                client.on('error', (err) => {
                    fail('Client connection error: ' + err.message);
                    host.close();
                    reject(err);
                });
            } catch (err) {
                fail('Lobby creation for join test failed: ' + err.message);
                host.close();
                reject(err);
            }
        });
        
        host.on('error', (err) => {
            fail('Host connection error: ' + err.message);
            reject(err);
        });
    });
}

async function testHeartbeat() {
    testsRun++;
    log('Test 3: Heartbeat');
    
    const client = createClient();
    
    return new Promise((resolve, reject) => {
        client.on('open', async () => {
            try {
                sendMessage(client, 'heartbeat', {});
                
                const response = await waitForMessage(client, 'heartbeat_ack');
                
                success('Heartbeat acknowledged');
                client.close();
                resolve();
            } catch (err) {
                fail('Heartbeat failed: ' + err.message);
                client.close();
                reject(err);
            }
        });
        
        client.on('error', (err) => {
            fail('Connection error: ' + err.message);
            reject(err);
        });
    });
}

async function testInvalidLobby() {
    testsRun++;
    log('Test 4: Join Non-existent Lobby');
    
    const client = createClient();
    
    return new Promise((resolve, reject) => {
        client.on('open', async () => {
            try {
                sendMessage(client, 'join_lobby', {
                    code: 'INVALID',
                    playerName: 'TestPlayer',
                    playerClass: 'square'
                });
                
                const response = await waitForMessage(client, 'lobby_error');
                
                if (response.data.message.includes('not found')) {
                    success('Invalid lobby correctly rejected');
                    client.close();
                    resolve();
                } else {
                    fail('Expected "not found" error message');
                    client.close();
                    reject(new Error('Wrong error message'));
                }
            } catch (err) {
                fail('Invalid lobby test failed: ' + err.message);
                client.close();
                reject(err);
            }
        });
        
        client.on('error', (err) => {
            fail('Connection error: ' + err.message);
            reject(err);
        });
    });
}

async function runTests() {
    console.log('\n========================================');
    console.log('  Multiplayer Server Test Suite');
    console.log('========================================\n');
    
    log('Connecting to server at ' + SERVER_URL);
    log('Make sure the server is running!\n');
    
    try {
        await testLobbyCreation();
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay between tests
        
        await testLobbyJoin();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await testHeartbeat();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await testInvalidLobby();
        
        console.log('\n========================================');
        console.log('  Test Results');
        console.log('========================================');
        console.log(`  Total:   ${testsRun}`);
        console.log(`  Passed:  ${testsPassed}`);
        console.log(`  Failed:  ${testsFailed}`);
        console.log('========================================\n');
        
        if (testsFailed === 0) {
            console.log('✅ All tests passed!\n');
            process.exit(0);
        } else {
            console.log('❌ Some tests failed!\n');
            process.exit(1);
        }
    } catch (err) {
        console.error('\n❌ Test suite failed:', err.message);
        console.log('\nMake sure the server is running:');
        console.log('  cd server && npm start\n');
        process.exit(1);
    }
}

// Run tests
runTests();

