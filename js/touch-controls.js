// Touch controls system - Virtual joysticks and touch input handling

class VirtualJoystick {
    constructor(x, y, radius = 60, deadZoneRadius = 15) {
        // Position and size
        this.centerX = x;
        this.centerY = y;
        this.radius = radius;
        this.deadZoneRadius = deadZoneRadius;
        
        // Current state
        this.active = false;
        this.touchId = null;
        this.currentX = x;
        this.currentY = y;
        
        // Output values
        this.angle = 0;
        this.magnitude = 0; // 0-1
        
        // Snap-back animation
        this.snapBackSpeed = 0.3; // How fast it snaps back (0-1 per frame)
    }
    
    // Start touch interaction
    startTouch(touchId, x, y, restrictedHitArea = false) {
        // Check if touch is within joystick area
        // Use restricted hit area when there are nearby buttons to prevent overlap
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Use smaller hit area (just radius) when restricted to avoid button overlap
        // Otherwise use slightly larger area (1.3x radius) for easier activation, but not 2x
        const hitRadius = restrictedHitArea ? this.radius : this.radius * 1.3;
        
        if (distance <= hitRadius) {
            this.active = true;
            this.touchId = touchId;
            this.updateTouch(touchId, x, y);
            return true;
        }
        return false;
    }
    
    // Update touch position
    updateTouch(touchId, x, y) {
        if (!this.active || this.touchId !== touchId) return;
        
        // Calculate offset from center
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Clamp to radius
        if (distance > this.radius) {
            const clampedDistance = this.radius;
            this.currentX = this.centerX + (dx / distance) * clampedDistance;
            this.currentY = this.centerY + (dy / distance) * clampedDistance;
        } else {
            this.currentX = x;
            this.currentY = y;
        }
        
        // Calculate angle and magnitude
        const effectiveDx = this.currentX - this.centerX;
        const effectiveDy = this.currentY - this.centerY;
        const effectiveDistance = Math.sqrt(effectiveDx * effectiveDx + effectiveDy * effectiveDy);
        
        this.angle = Math.atan2(effectiveDy, effectiveDx);
        
        // Calculate magnitude (0-1), accounting for dead zone
        if (effectiveDistance <= this.deadZoneRadius) {
            this.magnitude = 0;
        } else {
            const usableRange = this.radius - this.deadZoneRadius;
            this.magnitude = Math.min(1, (effectiveDistance - this.deadZoneRadius) / usableRange);
        }
    }
    
    // End touch interaction (snap back)
    endTouch(touchId) {
        if (this.touchId === touchId) {
            this.active = false;
            this.touchId = null;
            this.magnitude = 0;
        }
    }
    
    // Update snap-back animation
    update(deltaTime) {
        if (!this.active) {
            // Snap back to center
            const dx = this.centerX - this.currentX;
            const dy = this.centerY - this.currentY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 1) {
                const moveX = dx * this.snapBackSpeed;
                const moveY = dy * this.snapBackSpeed;
                this.currentX += moveX;
                this.currentY += moveY;
            } else {
                this.currentX = this.centerX;
                this.currentY = this.centerY;
            }
            
            this.magnitude = 0;
        }
    }
    
    // Get normalized direction vector
    getDirection() {
        if (this.magnitude === 0) {
            return { x: 0, y: 0 };
        }
        return {
            x: Math.cos(this.angle),
            y: Math.sin(this.angle)
        };
    }
    
    // Get magnitude (0-1)
    getMagnitude() {
        return this.magnitude;
    }
    
    // Get angle in radians
    getAngle() {
        return this.angle;
    }
    
    // Render joystick visual
    render(ctx) {
        // Outer ring background (subtle, shows full range) - more visible for mobile
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Outer ring border (more visible for mobile, cohesive design)
        ctx.strokeStyle = this.active ? 'rgba(200, 200, 255, 0.7)' : 'rgba(150, 150, 200, 0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Dead zone circle (subtle indicator)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.deadZoneRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner circle (follows finger) - larger and more visible for mobile
        const innerRadius = 26;
        ctx.fillStyle = this.active ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(this.currentX, this.currentY, innerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Border on inner circle (more prominent when active)
        ctx.strokeStyle = this.active ? 'rgba(255, 255, 255, 1.0)' : 'rgba(200, 200, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

// Touch button (for non-joystick abilities)
class TouchButton {
    constructor(x, y, width, height, label = '') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.label = label;
        this.active = false;
        this.touchId = null;
        this.pressed = false;
        this.justPressed = false;
        this.justReleased = false;
    }
    
    // Check if point is within button (with padding for easier tapping)
    contains(x, y) {
        // Add 8px padding around button for easier mobile tapping
        const padding = 8;
        return x >= this.x - padding && x <= this.x + this.width + padding &&
               y >= this.y - padding && y <= this.y + this.height + padding;
    }
    
    // Check if point is exactly within button bounds (no padding, for precise checks)
    containsExact(x, y) {
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
    }
    
    // Start touch
    startTouch(touchId, x, y) {
        if (this.contains(x, y)) {
            this.active = true;
            this.touchId = touchId;
            if (!this.pressed) {
                this.pressed = true;
                this.justPressed = true;
            }
            return true;
        }
        return false;
    }
    
    // End touch
    endTouch(touchId) {
        if (this.touchId === touchId) {
            this.active = false;
            this.touchId = null;
            if (this.pressed) {
                this.pressed = false;
                this.justReleased = true;
                // Store final state for abilities that need it (like blink)
                this.finalState = {
                    pressed: true,
                    x: this.x + this.width / 2,
                    y: this.y + this.height / 2
                };
            }
        }
    }
    
    // Update (call at end of frame to reset justPressed/justReleased)
    update() {
        this.justPressed = false;
        this.justReleased = false;
    }
    
    // Helper function to draw rounded rectangle
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    // Render button
    render(ctx, cooldown = 0, maxCooldown = 0, charges = null) {
        const cooldownPercent = maxCooldown > 0 ? cooldown / maxCooldown : 0;
        const isReady = charges !== null ? charges > 0 : cooldownPercent === 0;
        const isPressed = this.pressed;
        
        // Rounded rectangle background for cohesive design
        const radius = 8;
        const bgAlpha = isPressed ? 0.85 : (isReady ? 0.65 : 0.45);
        
        // Background with rounded corners (matches joystick style)
        ctx.fillStyle = `rgba(40, 40, 60, ${bgAlpha})`;
        this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
        ctx.fill();
        
        // Cooldown overlay (red tint when on cooldown)
        if (cooldownPercent > 0) {
            ctx.fillStyle = `rgba(200, 50, 50, ${bgAlpha * 0.9})`;
            this.drawRoundedRect(ctx, this.x, this.y, this.width * cooldownPercent, this.height, radius);
            ctx.fill();
        }
        
        // Border (more prominent for mobile, cohesive with joystick style)
        const borderWidth = isPressed ? 4 : 3;
        ctx.strokeStyle = isPressed ? 'rgba(200, 200, 255, 1.0)' : 
                         (isReady ? 'rgba(150, 150, 200, 0.7)' : 'rgba(100, 100, 150, 0.5)');
        ctx.lineWidth = borderWidth;
        this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
        ctx.stroke();
        
        // Label (larger text for mobile readability)
        if (this.label) {
            ctx.fillStyle = isReady ? '#ffffff' : 'rgba(200, 200, 220, 0.9)';
            ctx.font = 'bold 17px Arial'; // Larger font for mobile
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Text shadow for better readability
            ctx.shadowBlur = 3;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
            ctx.shadowBlur = 0;
            
            // Show charge count if provided (like dodge charges for Rogue)
            if (charges !== null && charges !== undefined) {
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 3;
                ctx.fillText(charges, this.x + this.width - 8, this.y + 6);
                ctx.shadowBlur = 0;
            }
        }
    }
}

