# Visual Flicker Panels - Modular System Design

## Overview
Transform the current single visual flicker system into a modular panel-based system similar to frequency panels, allowing up to 4 independent visual flicker channels.

## Current System Analysis

### Current Structure (timeline.js):
- Single `screenFlashState` object
- Properties: `currentRate`, `currentColor`, `currentDutyCycle`, `currentMode`
- Integrated into keyframe details panel
- Animation support through keyframe system

### Current Controls (in keyframe details):
- Visual Enabled (checkbox)
- Visual Color (color picker)
- Visual Rate (Hz) (number + slider)
- Duty Cycle (%) (number + slider)
- Visual Mode (screen/flashlight/auto)

## New System Design

### Architecture Overview
```
Visual Flicker System
├── VisualFlickerGenerator (class) - manages individual visual channels
├── visualGenerators (object) - stores multiple visual generators
├── Visual Panels Section (UI) - separate section for visual controls
└── Keyframe Integration - visual panels in keyframe data structure
```

### Visual Panel Data Structure
```javascript
visualPanel = {
    frequency: 10,        // Hz (0.01-100)
    dutyCycle: 50,        // Percentage (1-99)
    power: 100,           // Intensity/brightness (1-100)
    color: '#ffffff',     // RGB hex color
    mode: 'screen',       // 'screen', 'flashlight', 'auto'
    enabled: true,        // Panel on/off

    // Animation properties (like frequency panels)
    animate: false,
    fade: true,
    fadeDuration: 2
}
```

### VisualFlickerGenerator Class
```javascript
class VisualFlickerGenerator {
    constructor(panelId) {
        this.panelId = panelId;
        this.frequency = 10;
        this.dutyCycle = 50;
        this.power = 100;
        this.color = '#ffffff';
        this.mode = 'screen';
        this.enabled = true;
        this.animate = false;
        this.fade = true;
        this.fadeDuration = 2;

        // Runtime state
        this.isActive = false;
        this.startTime = 0;
        this.lastTimestamp = 0;
        this.phase = 0;
        this.animationId = null;
    }

    start() { /* Start this visual channel */ }
    stop() { /* Stop this visual channel */ }
    updateFrequency(freq) { /* Update frequency */ }
    updateDutyCycle(duty) { /* Update duty cycle */ }
    updatePower(power) { /* Update power/intensity */ }
    updateColor(color) { /* Update color */ }
    updateMode(mode) { /* Update mode */ }
}
```

## UI Implementation

### Visual Panels Section (new)
```html
<div class="visual-panels-section">
    <div class="visual-panels-header">
        <h3>Visual Flicker Panels</h3>
        <button class="add-visual-btn" onclick="addVisualPanel()">Add Visual Panel</button>
    </div>
    <div id="visual-panels" class="visual-panels-container">
        <!-- Visual panels will be added here -->
    </div>
</div>
```

### Individual Visual Panel HTML
```html
<div class="visual-panel" id="visual-1">
    <button class="remove-panel" onclick="removeVisualPanel('visual-1')">×</button>

    <div class="visual-controls">
        <div class="visual-input">
            <label>Frequency (Hz)</label>
            <input type="number" min="0.01" max="100" step="0.01" value="10">
            <div class="frequency-slider-container">
                <input type="range" min="0.01" max="100" value="10">
            </div>
        </div>

        <div class="visual-input">
            <label>Duty Cycle (%)</label>
            <input type="number" min="1" max="99" step="1" value="50">
            <div class="frequency-slider-container">
                <input type="range" min="1" max="99" value="50">
            </div>
        </div>

        <div class="visual-input">
            <label>Power/Intensity (%)</label>
            <input type="number" min="1" max="100" step="1" value="100">
            <div class="frequency-slider-container">
                <input type="range" min="1" max="100" value="100">
            </div>
        </div>

        <div class="visual-input">
            <label>Color</label>
            <input type="color" value="#ffffff">
        </div>

        <div class="visual-input">
            <label>Mode</label>
            <select>
                <option value="screen">🖥️ Screen Flash</option>
                <option value="flashlight">🔦 Flashlight</option>
                <option value="auto">🔄 Auto (Smart)</option>
            </select>
        </div>

        <!-- Animation controls (like frequency panels) -->
        <div class="visual-input">
            <label>
                <input type="checkbox" id="visual-1-animate"> Animate
            </label>
        </div>

        <div class="visual-input">
            <label>
                <input type="checkbox" id="visual-1-fade" checked> Fade
            </label>
        </div>

        <div class="visual-input">
            <label>Fade Duration (s)</label>
            <input type="number" min="0.1" max="10" step="0.1" value="2">
        </div>
    </div>
</div>
```

## Keyframe Integration

### Updated Keyframe Structure
```javascript
keyframe = {
    title: 'Key0',
    description: '',
    length: 10,
    guideText: '',

    // Remove single screenPanel, add visualPanels
    visualPanels: {
        'visual-1': {
            frequency: 10,
            dutyCycle: 50,
            power: 100,
            color: '#ffffff',
            mode: 'screen',
            enabled: true,
            animate: false,
            fade: true,
            fadeDuration: 2,

            // Inheritance metadata
            _inherited: {
                frequency: false,
                dutyCycle: true,
                power: false,
                // etc...
            }
        },
        'visual-2': { /* ... */ }
    },

    panels: { /* existing frequency panels */ },
    noisePanels: { /* existing noise panels */ }
}
```

### Inheritance Integration
- Visual panels fully integrated with inheritance system
- Each visual parameter can be inherited or explicit
- Visual panels appear in inheritance UI
- Works with keyframe animation and timeline

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create `VisualFlickerGenerator` class
2. Add `visualGenerators` global object
3. Create `addVisualPanel()` and `removeVisualPanel()` functions
4. Create visual panel HTML generation function

### Phase 2: Visual Rendering System
1. Refactor current visual flashing to support multiple channels
2. Implement visual compositing for multiple panels
3. Handle screen/flashlight mode per panel
4. Power/intensity scaling implementation

### Phase 3: UI Integration
1. Add visual panels section to main UI
2. Remove visual controls from keyframe details
3. Integrate with settings save/load
4. Add visual panel styling

### Phase 4: Keyframe Integration
1. Integrate visual panels with keyframe system
2. Add visual panels to inheritance system
3. Update keyframe saving/loading
4. Add animation support for visual parameters

### Phase 5: Advanced Features
1. Visual panel mixing/compositing
2. Power scaling and intensity control
3. Multiple flashlight support (if device supports)
4. Performance optimization for multiple panels

## Migration Strategy

### Backward Compatibility
```javascript
// Migration function for existing screenPanel data
function migrateScreenPanelToVisualPanels(keyframe) {
    if (keyframe.screenPanel && !keyframe.visualPanels) {
        keyframe.visualPanels = {
            'visual-1': {
                frequency: keyframe.screenPanel.rate || 10,
                dutyCycle: keyframe.screenPanel.dutyCycle || 50,
                power: 100, // Default power
                color: keyframe.screenPanel.color || '#ffffff',
                mode: keyframe.screenPanel.mode || 'screen',
                enabled: keyframe.screenPanel.enabled || false,
                animate: false,
                fade: true,
                fadeDuration: 2
            }
        };
        delete keyframe.screenPanel; // Remove old format
    }
}
```

## File Structure Changes

### New Files
- `visual-panels.js` - Visual panel management logic
- `visual-generator.js` - VisualFlickerGenerator class

### Modified Files
- `timeline.js` - Remove screenPanel logic, integrate visualPanels
- `settings.js` - Add visual panel management functions
- `app.js` - Integrate visual panels into main app
- `styles.css` - Visual panel styling
- `index.html` - Add visual panels section

## Expected Benefits

1. **Scalability**: Up to 4 independent visual channels
2. **Control**: Individual frequency, duty cycle, power per channel
3. **Animation**: Full keyframe animation support for all visual parameters
4. **Inheritance**: Visual parameters work with inheritance system
5. **Flexibility**: Mix screen flash and flashlight modes
6. **Consistency**: Same UI/UX patterns as frequency panels

## Technical Considerations

### Performance
- Multiple requestAnimationFrame loops may impact performance
- Consider unified animation loop for all visual panels
- Power scaling should be efficient

### Device Limitations
- Most devices have single flashlight
- Screen flashing can support multiple "virtual" channels through compositing
- Consider GPU acceleration for screen effects

### User Experience
- Clear visual indication of active panels
- Intuitive power/intensity control
- Consistent animation behaviors with audio panels

This design provides a comprehensive foundation for implementing modular visual flicker panels that match the functionality and user experience of the existing audio frequency panel system.