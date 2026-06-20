# Keyframe Value Inheritance System

## Context

The user is frustrated with the current keyframe system's requirement to manually update the same parameter across multiple keyframes. For example, if frequency F1 should be 400Hz across keyframes 0-4 but only volume changes in keyframe 2, updating the frequency from 400Hz to 450Hz requires manually editing all 5 keyframes individually. This is tedious and error-prone.

## Current System Analysis

From exploration of `/Users/ppisljar/_code/dmt/timeline.js` and `/Users/ppisljar/_code/dmt/settings.js`:

### Current Architecture:
- Each keyframe stores complete snapshots of all panel states (19 properties per frequency panel, 10 per noise panel)
- `createKeyframeFromCurrentState()` captures full generator state into keyframe data
- `loadKeyframeState()` applies complete keyframe data to generators
- No inheritance or propagation between keyframes - each is completely independent
- Only 3 UI events trigger `saveCurrentKeyframe()`: animate/fade/fadeDuration toggles

### Data Structure:
```javascript
keyframes[index] = {
  title, description, length, guideText,
  screenPanel: { enabled, color, rate, dutyCycle, mode },
  panels: {
    [panelId]: {
      frequency, waveType, volume, pan, lockTarget, frequencyOffset,
      isIsochronic, isochronicRate, isDelayedTone, delayTime,
      verticalModulation, horizontalModulation, modulationDepth,
      harmonicLayering, harmonicLayers, harmonicVolume,
      animate, fade, fadeDuration
    }
  },
  noisePanels: {
    [panelId]: { noiseType, volume, pan, pulsatingFrequency, ... }
  }
}
```

## Proposed Solution

Implement value inheritance where keyframes differentiate between explicitly set values vs inherited values, with forward propagation until override.

## Recommended Approach: Enhanced Keyframe Data Structure with Forward Propagation

Based on analysis of the current system and design exploration, I recommend implementing a metadata-based inheritance system that extends the existing keyframe structure while maintaining backward compatibility.

### Core Data Structure Changes

Enhanced Keyframe Structure (extend existing in `/Users/ppisljar/_code/dmt/timeline.js`):
```javascript
keyframe = {
  // Existing fields: title, description, length, guideText, screenPanel
  panels: {
    "panel-1": {
      // Existing values
      frequency: 440, waveType: "sine", volume: 0.5, pan: 0,

      // NEW: Inheritance metadata
      _inherited: {
        frequency: false,  // explicitly set in this keyframe
        waveType: true,    // inherited from previous keyframe
        volume: false,     // explicitly set
        pan: true         // inherited
      }
      // If _inherited missing, treat all values as explicit (backward compatibility)
    }
  }
}
```

## Implementation Strategy

### Phase 1: Core Inheritance Engine

1. **Extend `createKeyframeFromCurrentState()` function** (timeline.js:522):
   - Add inheritance metadata detection by comparing with previous keyframe
   - If value unchanged from previous keyframe, mark as inherited
   - If changed, mark as explicit

2. **Modify `loadKeyframeState()` function** (timeline.js:653):
   - Add inheritance resolution before applying values to generators
   - Walk backward through keyframes to find explicit values for inherited properties
   - Cache resolved values for performance

3. **Create inheritance resolution utility**:
```javascript
function resolveInheritedValue(keyframeIndex, panelId, property) {
  let currentIndex = keyframeIndex;
  while (currentIndex >= 0) {
    const kf = keyframes[currentIndex];
    const panel = kf.panels[panelId];
    if (panel && (!panel._inherited || !panel._inherited[property])) {
      return { value: panel[property], sourceKeyframe: currentIndex };
    }
    currentIndex--;
  }
  return { value: getDefaultValue(property), sourceKeyframe: null };
}
```

### Phase 2: UI Integration

1. **Add inheritance toggle controls** to keyframe details panel:
   - Checkbox next to each parameter: "Inherit from previous keyframe"
   - Visual indicators showing inherited vs explicit values

2. **Implement propagation preview**:
   - When changing an explicit value, show which keyframes will be affected
   - Add "Apply to following keyframes" button for bulk changes

3. **Visual feedback in parameter controls**:
   - Inherited values: dashed border, lighter background
   - Explicit values: solid border, normal styling
   - Recently changed: brief highlight animation

### Phase 3: Update Mechanisms

1. **Modify parameter update functions** in settings.js:
   - Add propagation logic: when explicit value changes, invalidate cache for dependent keyframes
   - Add override mechanism: way to make inherited value explicit in current keyframe

2. **Enhance keyframe switching**:
   - `switchToKeyframe()` should resolve all inherited values before loading
   - Cache resolved values to avoid repeated computation

## Critical File Modifications

1. **`/Users/ppisljar/_code/dmt/timeline.js`**:
   - `createKeyframeFromCurrentState()` (line 522): Add inheritance detection
   - `loadKeyframeState()` (line 653): Add inheritance resolution
   - Add new `resolveInheritedValue()` and `propagateValueChange()` functions

2. **`/Users/ppisljar/_code/dmt/settings.js`**:
   - Parameter update functions (`updateFrequency`, `updateVolume`, etc.): Add propagation logic
   - Add `makeValueExplicit()` and `makeValueInherited()` functions

3. **`/Users/ppisljar/_code/dmt/styles.css`**:
   - Add styling for inherited vs explicit parameter controls
   - Visual feedback for propagation preview

## Backward Compatibility Strategy

- Keyframes without `_inherited` metadata treated as all explicit values
- Migration function converts existing keyframes by comparing adjacent frames
- Save/load system preserves both old and new formats

## User Experience Workflow

1. **Default behavior**: New keyframes inherit all values from previous keyframe
2. **Making explicit**: User can check/uncheck "inherit" toggle for any parameter
3. **Bulk changes**: When changing explicit value, user sees preview of affected keyframes with option to apply
4. **Visual clarity**: Inherited parameters clearly distinguishable from explicit ones

## Implementation Phases

- **Phase 1** (2-3 days): Core inheritance resolution engine and data structure
- **Phase 2** (2-3 days): Basic UI toggles and visual indicators
- **Phase 3** (2-3 days): Propagation logic and bulk operations
- **Phase 4** (1-2 days): Polish, testing, and edge case handling

## Risk Mitigation

- Implement with feature flag that can be disabled
- Comprehensive backup of existing keyframe data
- Gradual rollout with fallback to current system
- Cache invalidation to prevent performance degradation

## Verification Plan

1. **Basic inheritance**: Change value in K0, verify K1-K4 inherit automatically
2. **Override boundary**: Make K5 explicit, verify K0 changes don't affect K5
3. **Timeline playback**: Ensure inherited values resolve correctly during animation
4. **Save/load**: Verify configurations preserve inheritance state correctly
5. **Performance**: Timeline playback performance remains smooth with inheritance enabled

This approach directly solves the user's problem by implementing forward propagation of parameter changes while providing clear visual feedback and maintaining the existing workflow paradigm.