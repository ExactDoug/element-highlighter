# Element Highlighter and Downloader

A userscript that allows you to visually select and download elements from web pages while preserving images, styles, and layout.

## Features

### Element Selection
- Visual highlighting of page elements on hover
- Click to select specific elements
- Escape key to cancel selection
- Ability to capture nested elements

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

1. Navigate to any webpage
2. Click the userscript manager icon
3. Select "Toggle Element Highlighter" from the menu
4. Hover over elements to highlight them
5. Click on an element to select it
6. Enter a filename in the prompt
7. Click OK to download the selected element as an HTML file

### Keyboard Shortcuts
- `Escape`: Cancel element selection mode

## Output Format

The script generates a standalone HTML file containing:
- The selected element with all nested content
- Original page source URL in comments
- Timestamp of capture
- Simplified but functional CSS
- Absolute URLs for all images
- Preserved layout and formatting

## Development

### Project Structure
```
html_data_scrape/
├── element-highlighter.user.js  # Main userscript
└── README.md                    # Documentation
```

### Future Development
Potential enhancements:
- Additional image format support
- Enhanced CSS preservation
- Customizable style retention
- Multiple element selection
- Custom keyboard shortcuts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Author

ExactDoug (http://exactpartners.com/)

## Version History

- 0.3 - CSS handling and simplification
- 0.2 - Enhanced image processing
- 0.1 - Initial release with basic functionality