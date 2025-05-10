// Signal Implementation
function createSignal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  function get() {
    return value;
  }

  function set(newValue) {
    if (value !== newValue) {
      value = newValue;
      subscribers.forEach((subscriber) => subscriber(value));
    }
  }

  function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  return { get, set, subscribe };
}

// Create a signal to track card content
const cardsContentSignal = createSignal(new Map());

// Create a map to track label colors
const labelColorsMap = new Map();

// Storage key for saved label colors
const STORAGE_KEY = 'trello_custom_label_colors';

// Function to save label colors to Chrome storage.sync
function saveLabelColors() {
  // Convert the Map to an object for storage
  const colorsObject = {};
  labelColorsMap.forEach((color, label) => {
    colorsObject[label] = color;
  });
  
  // Save to chrome.storage.sync
  chrome.storage.sync.set({ [STORAGE_KEY]: colorsObject }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving label colors:', chrome.runtime.lastError);
    }
  });
}

// Function to load saved label colors from Chrome storage.sync
function loadLabelColors() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading label colors:', chrome.runtime.lastError);
        resolve();
        return;
      }
      
      const savedColors = result[STORAGE_KEY] || {};
      
      // Clear the current map and load saved colors
      labelColorsMap.clear();
      Object.entries(savedColors).forEach(([label, color]) => {
        labelColorsMap.set(label, color);
      });
      
      resolve();
    });
  });
}

// Available color classes
const availableColors = [
  'color-green',
  'color-yellow',
  'color-orange',
  'color-red',
  'color-purple',
  'color-blue',
  'color-sky',
  'color-lime',
  'color-pink',
  'color-gray'
];

// Create a Map for color names
const colorNames = new Map([
  ['color-green', 'green'],
  ['color-yellow', 'yellow'],
  ['color-orange', 'orange'],
  ['color-red', 'red'],
  ['color-purple', 'purple'],
  ['color-blue', 'blue'],
  ['color-sky', 'sky'],
  ['color-lime', 'lime'],
  ['color-pink', 'pink'],
  ['color-gray', 'gray']
]);

// Track available colors to ensure we cycle through all before repeating
let availableColorPool = [...availableColors];

// Create a map to track label display names
const labelDisplayNameMap = new Map();

// Storage key for saved label display names
const DISPLAY_NAME_STORAGE_KEY = 'trello_custom_label_display_names';

// Function to save label display names to Chrome storage.sync
function saveLabelDisplayNames() {
  // Convert the Map to an object for storage
  const displayNameObject = {};
  labelDisplayNameMap.forEach((displayName, originalLabel) => {
    displayNameObject[originalLabel] = displayName;
  });
  
  // Save to chrome.storage.sync
  chrome.storage.sync.set({ [DISPLAY_NAME_STORAGE_KEY]: displayNameObject }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving label display names:', chrome.runtime.lastError);
    }
  });
}

// Function to load saved label display names from Chrome storage.sync
function loadLabelDisplayNames() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([DISPLAY_NAME_STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading label display names:', chrome.runtime.lastError);
        resolve();
        return;
      }
      
      const savedDisplayNames = result[DISPLAY_NAME_STORAGE_KEY] || {};
      
      // Clear the current map and load saved display names
      labelDisplayNameMap.clear();
      Object.entries(savedDisplayNames).forEach(([originalLabel, displayName]) => {
        labelDisplayNameMap.set(originalLabel, displayName);
      });
      
      resolve();
    });
  });
}

// Label popup state
const labelEditPopup = {
  isOpen: false,
  currentLabelText: '',
  currentColor: '',
  currentDisplayName: '',
  originalLabel: '',
  element: null,
  
  // Create the popup element if it doesn't exist
  initialize() {
    if (this.element) return;
    
    // Create the popup element
    const popup = document.createElement('div');
    popup.className = 'label-edit-popup';
    popup.setAttribute('data-testid', 'label-edit-popup');
    
    popup.innerHTML = `
      <div class="label-edit-popup-header">
        <h2>Edit label</h2>
        <button class="label-edit-popup-close" aria-label="Close popover">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="label-edit-popup-content">
        <div class="label-edit-popup-preview"></div>
        
        <h3>Title</h3>
        <div class="label-edit-title-input">
          <input type="text" class="label-title-input" placeholder="Label text">
          <p class="original-hashtag-note">Original hashtag: <span class="original-hashtag"></span></p>
        </div>
        
        <h3>Select a color</h3>
        <div class="color-palette">
          ${availableColors.map(color => `
            <button class="color-tile ${color}" data-color="${color}" aria-label="${colorNames.get(color)}"></button>
          `).join('')}
        </div>
      </div>
      <div class="label-edit-popup-footer">
        <button class="label-edit-popup-save">Save</button>
        <button class="label-edit-popup-delete">Reset to default</button>
      </div>
    `;
    
    // Append popup to document body
    document.body.appendChild(popup);
    this.element = popup;
    
    // Add event listeners
    this.addEventListeners();
  },
    // Add all event listeners for the popup
  addEventListeners() {
    // Close button listener
    const closeButton = this.element.querySelector('.label-edit-popup-close');
    closeButton.addEventListener('click', () => this.close());
    
    // Color tile listeners
    const colorTiles = this.element.querySelectorAll('.color-tile');
    colorTiles.forEach(tile => {
      tile.addEventListener('click', (e) => {
        this.selectColor(e.currentTarget.dataset.color);
      });
    });
    
    // Label title input listener
    const titleInput = this.element.querySelector('.label-title-input');
    titleInput.addEventListener('input', (e) => {
      this.updateLabelPreview(e.target.value);
    });
    
    // Save button listener
    const saveButton = this.element.querySelector('.label-edit-popup-save');
    saveButton.addEventListener('click', () => {
      this.updateLabelDisplay();
      this.close();
    });
    
    // Reset button listener
    const resetButton = this.element.querySelector('.label-edit-popup-delete');
    resetButton.addEventListener('click', () => {
      this.resetToDefault();
      this.close();
    });
    
    // Close popup when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (this.isOpen && this.element && !this.element.contains(e.target)) {
        this.close();
      }
    });
    
    // Listen for keyboard shortcuts
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // Ctrl/Cmd + Enter to save
        e.preventDefault();
        this.updateLabelDisplay();
        this.close();
      } else if (e.key === 'Escape') {
        // Escape to cancel
        e.preventDefault();
        this.close();
      }
    });
  },
    // Open the popup with the label details
  open(labelElement, labelText, currentColor) {
    if (!this.element) this.initialize();
    
    // Store original label text (hashtag without the #)
    this.originalLabel = labelText;
    
    // Get the display name from the map or use the original label text
    const displayName = labelDisplayNameMap.get(labelText) || labelText;
    
    // Store current data
    this.currentLabelText = labelText;
    this.currentDisplayName = displayName;
    this.currentColor = currentColor;
    
    // Update preview
    const previewEl = this.element.querySelector('.label-edit-popup-preview');
    previewEl.innerHTML = `
      <div class="custom-label ${currentColor}">
        <span class="value">${displayName}</span>
      </div>
    `;
    
    // Update title input
    const titleInput = this.element.querySelector('.label-title-input');
    titleInput.value = displayName;
    
    // Update original hashtag note
    this.element.querySelector('.original-hashtag').textContent = `#${labelText}`;
    
    // Update selected color in palette
    const colorTiles = this.element.querySelectorAll('.color-tile');
    colorTiles.forEach(tile => {
      tile.classList.toggle('selected', tile.dataset.color === currentColor);
    });
    
    // Position the popup
    const labelRect = labelElement.getBoundingClientRect();
    this.element.style.top = `${labelRect.bottom + 10}px`;
    this.element.style.left = `${labelRect.left}px`;
    
    // Show the popup
    this.element.style.display = 'block';
    this.isOpen = true;
    
    // Focus the title input for immediate editing
    setTimeout(() => {
      titleInput.focus();
      titleInput.select();
    }, 50);
  },
  // Close the popup
  close() {
    if (this.element) {
      this.element.style.display = 'none';
      
      // Reset if user closes without saving (escape key, outside click, etc)
      // We don't do this when user clicks Save or Reset buttons directly
      if (this._closeWithoutSave !== false) {
        // Restore the old color if it was changed
        if (this._oldColor !== undefined) {
          // Restore the old color in the map
          if (this._oldColor) {
            labelColorsMap.set(this.currentLabelText, this._oldColor);
          } else {
            labelColorsMap.delete(this.currentLabelText);
          }
          
          // Restore the original color on all instances
          const colorToRestore = this._oldColor || getColorForLabel(this.currentLabelText);
          document.querySelectorAll(`.custom-label[data-label-text="${this.currentLabelText}"]`).forEach(label => {
            // Remove all color classes
            availableColors.forEach(color => {
              label.classList.remove(color);
            });
            // Add the original color back
            label.classList.add(colorToRestore);
          });
        }
        
        // Restore the display name if it was changed temporarily
        if (this._oldDisplayName !== undefined) {
          // Get the current saved display name or default to original
          const displayName = labelDisplayNameMap.get(this.currentLabelText) || this.currentLabelText;
          
          // Restore display name on all instances
          document.querySelectorAll(`.custom-label[data-label-text="${this.currentLabelText}"]`).forEach(label => {
            const valueEl = label.querySelector('.value');
            if (valueEl) {
              valueEl.textContent = displayName;
            }
          });
        }
      }
      
      // Reset tracking variables
      this._oldColor = undefined;
      this._oldDisplayName = undefined;
      this._closeWithoutSave = undefined;
    }
    this.isOpen = false;
  },
  // Select a color in the palette
  selectColor(colorClass) {
    // Update selected color
    this.currentColor = colorClass;
    
    // Update UI to show selected color
    const colorTiles = this.element.querySelectorAll('.color-tile');
    colorTiles.forEach(tile => {
      tile.classList.toggle('selected', tile.dataset.color === colorClass);
    });
    
    // Update preview
    const previewEl = this.element.querySelector('.label-edit-popup-preview .custom-label');
    if (previewEl) {
      // Remove all color classes
      availableColors.forEach(color => {
        previewEl.classList.remove(color);
      });
      // Add the new color
      previewEl.classList.add(colorClass);
    }
    
    // Apply the color change immediately to all labels
    // This creates a more responsive feel before saving
    if (this.isOpen && this.currentLabelText) {
      // Temporarily update the labelColorsMap for live preview
      const oldColor = labelColorsMap.get(this.currentLabelText);
      labelColorsMap.set(this.currentLabelText, colorClass);
      
      // Update all instances of this label throughout the board
      document.querySelectorAll(`.custom-label[data-label-text="${this.currentLabelText}"]`).forEach(label => {
        // Remove all color classes
        availableColors.forEach(color => {
          label.classList.remove(color);
        });
        // Add the new color
        label.classList.add(colorClass);
      });
      
      // Store the old color in case user cancels
      this._oldColor = oldColor;
    }
  },// Update label color in global map
  updateLabelColor() {
    if (this.currentLabelText && this.currentColor) {
      // Mark this as a deliberate save, not just closing
      this._closeWithoutSave = false;
      
      // Update the label color in our map
      labelColorsMap.set(this.currentLabelText, this.currentColor);
      
      // Save changes to Chrome storage
      saveLabelColors();
      
      // Update all instances of this label immediately for a more responsive feel
      document.querySelectorAll(`.custom-label[data-label-text="${this.currentLabelText}"]`).forEach(label => {
        // Remove all color classes
        availableColors.forEach(color => {
          label.classList.remove(color);
        });
        // Add the new color
        label.classList.add(this.currentColor);
      });
      
      // Refresh all cards to ensure consistency
      processCardNames();
    }
  },
  
  // Remove color (reset to default)
  removeColor() {
    if (this.currentLabelText) {
      // Mark this as a deliberate save, not just closing
      this._closeWithoutSave = false;
      
      // Remove the label color from our map
      labelColorsMap.delete(this.currentLabelText);
      
      // Save changes to Chrome storage
      saveLabelColors();
      
      // Get a new color for this label
      const newColor = getColorForLabel(this.currentLabelText);
      
      // Update all instances of this label immediately
      document.querySelectorAll(`.custom-label[data-label-text="${this.currentLabelText}"]`).forEach(label => {
        // Remove all color classes
        availableColors.forEach(color => {
          label.classList.remove(color);
        });
        // Add the new color
        label.classList.add(newColor);
      });
      
      // Refresh all cards to ensure consistency
      processCardNames();
    }
  },
  
  // Update the preview as user types
  updateLabelPreview(newText) {
    // Update current display name
    this.currentDisplayName = newText;
    
    // Update preview element
    const previewLabel = this.element.querySelector('.label-edit-popup-preview .custom-label .value');
    if (previewLabel) {
      previewLabel.textContent = newText;
    }
  },
  
  // Update the display name for the label
  updateLabelDisplay() {
    if (this.originalLabel) {
      // Mark this as a deliberate save
      this._closeWithoutSave = false;
      
      const newDisplayName = this.currentDisplayName.trim();
      
      if (newDisplayName === this.originalLabel) {
        // If the display name is the same as original, remove the mapping
        labelDisplayNameMap.delete(this.originalLabel);
      } else {
        // Otherwise, save the custom display name
        labelDisplayNameMap.set(this.originalLabel, newDisplayName);
      }
      
      // Save display names to storage
      saveLabelDisplayNames();
      
      // Update the color if it was changed
      if (this.currentColor) {
        labelColorsMap.set(this.originalLabel, this.currentColor);
        saveLabelColors();
      }
      
      // Update all instances of this label immediately
      document.querySelectorAll(`.custom-label[data-label-text="${this.originalLabel}"]`).forEach(label => {
        // Update the display value
        const valueEl = label.querySelector('.value');
        if (valueEl) {
          valueEl.textContent = newDisplayName;
        }
        
        // Update the color if needed
        if (this.currentColor) {
          // Remove all color classes
          availableColors.forEach(color => {
            label.classList.remove(color);
          });
          // Add the new color
          label.classList.add(this.currentColor);
        }
      });
      
      // Refresh all cards to ensure consistency
      processCardNames();
    }
  },
  
  // Reset the label to its default state
  resetToDefault() {
    if (this.originalLabel) {
      // Mark this as a deliberate save
      this._closeWithoutSave = false;
      
      // Remove any custom display name
      labelDisplayNameMap.delete(this.originalLabel);
      
      // Remove any custom color
      labelColorsMap.delete(this.originalLabel);
      
      // Save changes to storage
      saveLabelDisplayNames();
      saveLabelColors();
      
      // Get a new color for this label
      const newColor = getColorForLabel(this.originalLabel);
      
      // Update all instances of this label immediately
      document.querySelectorAll(`.custom-label[data-label-text="${this.originalLabel}"]`).forEach(label => {
        // Reset the display value to the original text
        const valueEl = label.querySelector('.value');
        if (valueEl) {
          valueEl.textContent = this.originalLabel;
        }
        
        // Update the color
        availableColors.forEach(color => {
          label.classList.remove(color);
        });
        label.classList.add(newColor);
      });
      
      // Refresh all cards to ensure consistency
      processCardNames();
    }
  },
};

// Function to get a consistent color for a hashtag
function getColorForLabel(labelText) {
  // If we already assigned a color to this label, return it
  if (labelColorsMap.has(labelText)) {
    return labelColorsMap.get(labelText);
  }
  
  // If we've used all colors, refill the pool
  if (availableColorPool.length === 0) {
    availableColorPool = [...availableColors];
  }
  
  // Pick a random color from the remaining pool
  const randomIndex = Math.floor(Math.random() * availableColorPool.length);
  const colorClass = availableColorPool[randomIndex];
  
  // Remove the selected color from the pool
  availableColorPool.splice(randomIndex, 1);
  
  // Store the color assignment for consistency
  labelColorsMap.set(labelText, colorClass);
  
  // Save the new color assignment to storage
  saveLabelColors();
  
  return colorClass;
}

function processCardNames() {
  // Process all cards in a single batch to minimize reflows
  const cards = Array.from(document.querySelectorAll('[data-testid="card-name"]:not([data-processing="true"])'));
  
  // Skip if nothing to process
  if (!cards.length) return;
  
  // First, mark all cards as processing to prevent duplicative work
  cards.forEach(el => {
    el.dataset.processing = 'true';
  });
  
  // Now process each card with minimal DOM updates
  cards.forEach(el => {
    const cardId = el.getAttribute('href')?.split('/').pop() || '';
    const text = el.textContent.trim();
    
    // Skip if we've already processed this exact content
    const cardMap = cardsContentSignal.get();
    if (cardId && cardMap.get(cardId) === text && el.dataset.processed === 'true') {
      el.dataset.processing = 'false';
      return;
    }
    
    // Update our signal with the latest card content
    if (cardId) {
      const newMap = new Map(cardMap);
      newMap.set(cardId, text);
      cardsContentSignal.set(newMap);
    }

    // Prepare the HTML fragments before touching the DOM
    const fragments = prepareCardFragments(text);
    if (!fragments) {
      el.dataset.processing = 'false';
      el.dataset.processed = 'true';
      return;
    }
    
    // Now batch all DOM operations together
    const { originalLabelSpan, labelSection, numberSection } = fragments;
    
    // Clean card name content
    const tempEl = document.createElement('div');
    tempEl.innerHTML = el.innerHTML;
    
    // Clean old injections first
    Array.from(tempEl.querySelectorAll('.custom-label-wrapper, .custom-number-wrapper, .custom-labels-original')).forEach(e => e.parentNode.removeChild(e));
    
    // Apply the original label span if needed
    if (originalLabelSpan) {
      const originalLabelRegex = new RegExp(originalLabelSpan.originalText.replace(/([()])/g, '\\$1'));
      tempEl.innerHTML = tempEl.innerHTML.replace(originalLabelRegex, originalLabelSpan.html);
    }
    
    // Apply cleaned content to card name
    el.innerHTML = tempEl.innerHTML;
    
    // Now find and inject the label and number sections into the badges area
    if (labelSection || numberSection) {
      // Find the card-front-badges element
      const cardElement = el.closest('[data-testid="trello-card"]');
      if (cardElement) {
        const badgesElement = cardElement.querySelector('[data-testid="card-front-badges"]');
        if (badgesElement) {
          // Clean existing custom labels from badges
          Array.from(badgesElement.querySelectorAll('.custom-label-wrapper, .custom-number-wrapper')).forEach(e => e.parentNode.removeChild(e));
          
          // Append new badges
          badgesElement.insertAdjacentHTML('beforeend', labelSection + numberSection);
          
          // Add click listeners to the custom labels
          const customLabels = badgesElement.querySelectorAll('.custom-label');
          customLabels.forEach(label => {
            // Remove any existing listeners
            if (label.getAttribute('data-has-listener') === 'true') {
              return;
            }
            
            label.setAttribute('data-has-listener', 'true');
            
            label.addEventListener('click', (e) => {
              // Prevent the click from opening the card
              e.preventDefault();
              e.stopPropagation();
              
              // Get label information
              const labelText = label.dataset.labelText;
              const currentColor = Array.from(label.classList).find(cls => cls.startsWith('color-'));
              
              // Open the color picker popup
              labelEditPopup.open(label, labelText, currentColor);
              
              return false;
            });
          });
        }
      }
    }
    
    el.dataset.processing = 'false';
    el.dataset.processed = 'true';
  });
}

// Helper function to prepare card fragments without touching DOM
function prepareCardFragments(text) {
  const hashtags = [...text.matchAll(/#(\w+)/g)];
  const numbers = [...text.matchAll(/\((\d+)\)/g)];
  
  if (!hashtags.length && !numbers.length) return null;
  
  // Prepare original labels span
  let originalLabelSpan = null;
  const originalLabels = [
    ...hashtags.map(h => `#${h[1]}`),
    ...numbers.map(n => `(${n[1]})`)
  ].join(' ');
  
  if (originalLabels) {
    const safeOriginal = originalLabels
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    originalLabelSpan = {
      originalText: originalLabels,
      html: `<span class="custom-labels-original">${safeOriginal}</span>`
    };
  }
  // Prepare label section HTML
  let labelSection = '';
  if (hashtags.length) {
    labelSection = `<section class="custom-label-wrapper">` +
      hashtags.map(h => {
        const labelText = h[1];
        const displayName = labelDisplayNameMap.get(labelText) || labelText;
        const colorClass = getColorForLabel(labelText);
        return `
        <div class="custom-label ${colorClass}" data-label-text="${labelText}">
          <span class="hashtag">#</span>
          <span class="value">${displayName}</span>
        </div>`;
      }).join('') +
      `</section>`;
  }
  
  // Prepare number section HTML
  let numberSection = '';
  if (numbers.length) {
    numberSection = `<section class="custom-number-wrapper">` +
      numbers.map(n => `
        <div class="custom-number">
          <span class="parenthesis">(</span>
          <span class="value">${n[1]}</span>
          <span class="parenthesis">)</span>
        </div>`).join('') +
      `</section>`;
  }
  
  return { originalLabelSpan, labelSection, numberSection };
}

// Track edit state and card mutations
function trackCardEditing() {
  // Watch for the editing form to appear
  const editForm = document.querySelector('form textarea[data-testid="quick-card-editor-card-title"]');
  if (editForm && !editForm.dataset.listenerAttached) {
    editForm.dataset.listenerAttached = 'true';
    
    // Track the form itself for changes
    editForm.addEventListener('input', () => {
      // Store the current editing value for faster processing after save
      window.currentEditingValue = editForm.value;
    });
    
    // Track save button clicks
    const saveButton = document.querySelector('form button[type="submit"]');
    if (saveButton && !saveButton.dataset.listenerAttached) {
      saveButton.dataset.listenerAttached = 'true';
      saveButton.addEventListener('click', () => {
        // Pre-process the card that's about to be saved
        const cardBeingEdited = document.querySelector('[data-testid="quick-card-editor"]')?.closest('.list-card');
        if (cardBeingEdited) {
          // Flag this card for immediate processing when it reappears
          const cardId = cardBeingEdited.querySelector('a[href]')?.getAttribute('href')?.split('/').pop();
          if (cardId) {
            window.cardPendingUpdate = cardId;
          }
        }
        
        // Set up a multi-phase processing to catch the update at different points
        // Trello updates the DOM in unpredictable ways, so we'll try multiple times
        const processTimes = [50, 100, 200, 400];
        processTimes.forEach(delay => {
          setTimeout(() => processCardNames(), delay);
        });
      });
    }
  }
  
  // Also check for the escape key to detect edit cancellation
  if (!window.editCancelListenerAttached) {
    window.editCancelListenerAttached = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.querySelector('form textarea[data-testid="quick-card-editor-card-title"]')) {
        // If ESC is pressed while editing, process cards after cancellation
        setTimeout(processCardNames, 100);
      }
    });
  }
}

// Function to determine if an element is a card or contains cards that need processing
function elementNeedsProcessing(node) {
  // Fast check for common Trello patterns
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  
  // Direct match for card name or badges
  if (node.getAttribute) {
    const testId = node.getAttribute('data-testid');
    if (testId === 'card-name' || testId === 'card-front-badges') return true;
  }
  
  // Check if it contains card names or badges
  if (node.querySelector) {
    return !!(node.querySelector('[data-testid="card-name"]') || 
              node.querySelector('[data-testid="card-front-badges"]') ||
              node.querySelector('[data-testid="trello-card"]'));
  }
  
  return false;
}

// Set up observers and listeners
function setupObservers() {
  // Main mutation observer with improved handling
  const observer = new MutationObserver((mutations) => {
    let needsProcessing = false;
    let hasEditForm = false;
    
    // Quick check for relevant mutations
    for (const mutation of mutations) {
      // Check if we have editing happening
      if (mutation.target && 
          (mutation.target.querySelector?.('form textarea[data-testid="quick-card-editor-card-title"]') || 
           (mutation.target.getAttribute && mutation.target.getAttribute('data-testid') === 'quick-card-editor-card-title'))) {
        hasEditForm = true;
      }
      
      // Check if cards were added or modified
      if (mutation.type === 'childList') {
        // Check added nodes
        for (const node of mutation.addedNodes) {
          if (elementNeedsProcessing(node)) {
            needsProcessing = true;
            break;
          }
        }
        
        // Also check the target if nodes were removed (might indicate card updates)
        if (!needsProcessing && mutation.removedNodes.length > 0 && elementNeedsProcessing(mutation.target)) {
          needsProcessing = true;
        }
      } else if (mutation.type === 'attributes' || mutation.type === 'characterData') {
        // Check if attributes changed on a card or card container
        if (elementNeedsProcessing(mutation.target)) {
          needsProcessing = true;
        }
      }
      
      if (needsProcessing && hasEditForm) break;
    }
    
    // Track editing if needed
    if (hasEditForm) {
      trackCardEditing();
    }
    
    // Process cards if needed
    if (needsProcessing) {
      clearTimeout(window.processingTimeout);
      window.processingTimeout = setTimeout(() => {
        processCardNames();
      }, 10); // Use a very short delay for initial processing
    }
  });
  // Use a more targeted observer config
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-testid', 'class', 'href', 'data-card-id']
  });
}

// Function to run initial processing and handle page-wide events
async function initializeScript() {
  // Set up page state
  window.cardPendingUpdate = null;
  window.currentEditingValue = null;
  window.processingTimeout = null;
  window.editCancelListenerAttached = false;
    // Load any saved label colors and display names from Chrome storage
  await Promise.all([
    loadLabelColors(),
    loadLabelDisplayNames()
  ]);
  
  // Initialize label popup
  labelEditPopup.initialize();
  
  // Add URL change detection for SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Process cards after page navigation
      setTimeout(processCardNames, 100);
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Process whenever a list is scrolled (for lazy-loaded cards)
  document.addEventListener('scroll', (e) => {
    // Only process if the scroll event is from a list
    if (e.target.closest && e.target.closest('.list-cards')) {
      clearTimeout(window.scrollProcessTimeout);
      window.scrollProcessTimeout = setTimeout(processCardNames, 200);
    }
  }, true);
  
  // Set up the main observers
  setupObservers();
  
  // Run initial processing in phases to catch everything
  // This helps prevent FOUC by processing at multiple intervals
  processCardNames();
  
  // Additional processing after a short delay to catch lazy-loaded content
  setTimeout(processCardNames, 300);
  setTimeout(processCardNames, 1000);
    // Add listener for storage changes from other tabs/devices
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      let needsRefresh = false;
      
      // Check for color changes
      if (changes[STORAGE_KEY]) {
        const newColors = changes[STORAGE_KEY].newValue || {};
        
        // Update local map with the new colors
        labelColorsMap.clear();
        Object.entries(newColors).forEach(([label, color]) => {
          labelColorsMap.set(label, color);
        });
        
        needsRefresh = true;
      }
      
      // Check for display name changes
      if (changes[DISPLAY_NAME_STORAGE_KEY]) {
        const newDisplayNames = changes[DISPLAY_NAME_STORAGE_KEY].newValue || {};
        
        // Update local map with the new display names
        labelDisplayNameMap.clear();
        Object.entries(newDisplayNames).forEach(([originalLabel, displayName]) => {
          labelDisplayNameMap.set(originalLabel, displayName);
        });
        
        needsRefresh = true;
      }
      
      // Refresh all cards if either colors or display names changed
      if (needsRefresh) {
        processCardNames();
      }
    }
  });
}

// Start everything
initializeScript();

// Load saved label colors on extension startup
loadLabelColors().then(() => {
  // Apply loaded colors to all labels
  document.querySelectorAll('.custom-label').forEach(label => {
    const labelText = label.dataset.labelText;
    if (labelColorsMap.has(labelText)) {
      const colorClass = labelColorsMap.get(labelText);
      label.classList.add(colorClass);
    }
  });
});