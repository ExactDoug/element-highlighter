# Element Highlighter and Downloader

A userscript that allows you to visually select and download elements from web pages while preserving images, styles, and layout.

## Features

### Element Selection

- Visual highlighting of page elements on hover
- Click to select specific elements
- Shift+Click to select multiple elements
- Selection panel showing all selected elements
- Ability to remove individual elements from selection
- Escape key to cancel selection
- Ability to capture nested elements

### Multiple Element Selection

- Select multiple elements with Shift+Click
- Visual indicators showing selected elements
- Selection panel to manage selected elements
- Download all selected elements as a single HTML file
- Clear all selections with a single click
- Keyboard shortcuts:
  - `C`: Clear all selections
  - `D`: Download selected elements
  - `Escape`: Exit selection mode

1. Activate the Element Highlighter
2. Hold Shift and click on elements to add them to selection
3. Use the selection panel to:
   - View all selected elements
   - Remove specific elements
   - Highlight individual elements
   - Download all selected elements
   - Clear all selections

### Image Processing

- Converts relative image URLs to absolute
- Preserves image dimensions
- Handles `<picture>` elements and srcset
- Processes SVG elements with dimension preservation
- Extracts background images from CSS
- Maintains responsive image functionality

### CSS Handling

- Preserves essential styles:
  - Layout (width, height, margin, padding)
  - Text formatting (font-size, weight, alignment, color)
  - Background colors
  - Borders and border-radius
  - Table formatting
  - Flexbox properties
- Converts external CSS to inline styles
- Includes minimal base CSS for consistency

## Code Organization

The script is organized into logical modules:

### URL Utilities Module

- Handles URL conversion from relative to absolute
- Processes different URL formats (data URIs, root-relative, etc.)

### Element Processor Module

- Processes HTML elements for download
- Handles links, images, and styles
- Special processing for SVG elements
- Extracts background images from CSS

### UI Manager Module

- Manages user interface elements
- Handles overlay creation and styling
- Creates and updates the selection panel
- Displays notifications to the user

### Selection Manager Module

- Manages the list of selected elements
- Handles adding and removing elements from selection
- Creates visual indicators for selected elements
- Highlights selected elements when requested

### Highlighter Module

- Controls element highlighting functionality
- Manages mouse and keyboard interactions
- Toggles highlight mode on/off
- Coordinates multiple element selection

### Downloader Module

- Handles the actual element download
- Creates standalone HTML with preserved styling
- Downloads single elements or multiple elements
- Generates downloadable blobs

## Installation

1. Install a userscript manager:
   - [Violentmonkey](https://violentmonkey.github.io/)
   - [Greasemonkey](https://www.greasespot.net/)
   - [Tampermonkey](https://www.tampermonkey.net/)

2. Install this script:
   - Click the userscript manager icon
   - Create new script
   - Copy and paste the contents of `element-highlighter.user.js`
   - Save the script

## Usage

### Basic Usage

1. Navigate to any webpage
2. Click the userscript manager icon
3. Select "Toggle Element Highlighter" from the menu
4. Hover over elements to highlight them
5. Click on an element to select and download it. Note that during highlighting, default browser text selection and context menu behaviors are prevented to ensure smooth element selection.

### Important Note

When the element highlighter is active, the default browser behavior of text selection using the Shift key and context menus are disabled to ensure seamless element selection.

### Keyboard Shortcuts

- `Shift+Click`: Add element to selection. Note: holding Shift key during highlighting will not trigger default browser text selection.
- `C`: Clear all selections
- `D`: Download all selected elements
- `Escape`: Exit element selection mode

## Output Format

For single elements, the script generates a standalone HTML file containing:

- The selected element with all nested content
- Original page source URL in comments
- Timestamp of capture
- Simplified but functional CSS
- Absolute URLs for all images
- Preserved layout and formatting

For multiple elements, the output includes:

- All selected elements in a single HTML file
- Elements separated with clear headers
- Page metadata including source URL and capture time
- Print-friendly styling for documentation or reports

## Development

### Project Structure

```shell:
html_data_scrape/
├── element-highlighter.user.js  # Main userscript
└── README.md                    # Documentation
```

### Future Development

Potential enhancements:

- Additional image format support
- Enhanced CSS preservation
- Customizable style retention
- Custom keyboard shortcuts
- Settings panel for configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Author

ExactDoug (<http://exactpartners.com/>)

## Version History

- 0.5 - Multiple element selection with selection management panel
- 0.4 - Code organization into logical modules with improved documentation
- 0.3 - CSS handling and simplification
- 0.2 - Enhanced image processing
- 0.1 - Initial release with basic functionality
