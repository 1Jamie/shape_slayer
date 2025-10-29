// Input system - handles keyboard and mouse input

const Input = {
    // Key states
    keys: {},
    
    // Mouse state
    mouse: {
        x: 0,
        y: 0
    },
    mouseLeft: false,
    mouseRight: false,
    
    // Initialize input handlers
    init(canvas) {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Mouse position
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        // Mouse buttons
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseLeft = true;
            if (e.button === 2) this.mouseRight = true;
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseLeft = false;
            if (e.button === 2) this.mouseRight = false;
        });
        
        // Prevent context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    },
    
    // Check if a key is pressed
    isKeyPressed(key) {
        return this.keys[key.toLowerCase()] === true;
    },
    
    // Get key state
    getKeyState(key) {
        return this.keys[key.toLowerCase()] || false;
    }
};


