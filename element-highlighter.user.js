// ==UserScript==
// @name         Element Highlighter and Downloader
// @namespace    http://exactpartners.com/
// @version      0.3
// @description  Highlight and download webpage elements with simplified CSS
// @author       ExactDoug
// @match        *://*/*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.backgroundColor = 'rgba(0, 123, 255, 0.2)';
    overlay.style.display = 'none';
    overlay.style.zIndex = '10000';
    document.body.appendChild(overlay);

    // Variables to store state
    let isActive = false;
    let currentElement = null;
    let isDownloading = false;

    // Utility function to convert relative URL to absolute
    function toAbsoluteUrl(relativeUrl) {
        if (!relativeUrl) return '';
        if (relativeUrl.startsWith('data:')) return relativeUrl; // Preserve data URLs
        if (relativeUrl.match(/^(https?:)?\/\//i)) return relativeUrl; // Already absolute

        const a = document.createElement('a');
        a.href = relativeUrl;
        return a.href;
    }

    // Function to process external CSS background images
    function processExternalCSS() {
        const styleSheets = Array.from(document.styleSheets);
        const backgroundImages = new Map();

        styleSheets.forEach(sheet => {
            try {
                const rules = Array.from(sheet.cssRules || []);
                rules.forEach(rule => {
                    if (rule.style && rule.style.backgroundImage) {
                        const urlMatch = rule.style.backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
                        if (urlMatch) {
                            backgroundImages.set(rule.selectorText, toAbsoluteUrl(urlMatch[1]));
                        }
                    }
                });
            } catch (e) {
                // Skip cross-origin stylesheets
            }
        });

        return backgroundImages;
    }

    // Function to process SVG elements
    function processSVG(svg) {
        try {
            // Preserve explicit width/height attributes
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            const style = svg.getAttribute('style');
            const computedStyle = window.getComputedStyle(svg);

            // If explicit attributes exist, keep them
            if (width) svg.setAttribute('width', width);
            if (height) svg.setAttribute('height', height);

            // If no explicit attributes but has style dimensions
            if (!width && !height && style) {
                if (style.includes('width') || style.includes('height')) {
                    svg.setAttribute('style', style);
                }
            }

            // If no explicit dimensions at all, use computed values
            if (!width && !height && !style) {
                const computedWidth = computedStyle.width;
                const computedHeight = computedStyle.height;
                if (computedWidth !== 'auto' && computedHeight !== 'auto') {
                    svg.setAttribute('width', computedWidth);
                    svg.setAttribute('height', computedHeight);
                }
            }

            // Ensure viewBox is present
            if (!svg.getAttribute('viewBox')) {
                let viewBoxWidth = svg.width.baseVal.value || parseInt(computedStyle.width);
                let viewBoxHeight = svg.height.baseVal.value || parseInt(computedStyle.height);
                if (viewBoxWidth && viewBoxHeight) {
                    svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
                }
            }

            // Process internal image references
            svg.querySelectorAll('image').forEach(image => {
                const href = image.getAttribute('href') || image.getAttribute('xlink:href');
                if (href) {
                    image.setAttribute('href', toAbsoluteUrl(href));
                }
            });
        } catch (e) {
            console.error('SVG processing failed:', e);
        }

        return svg;
    }

    // Function to process image elements
    function processImages(element) {
        const clone = element.cloneNode(true);
        const backgroundImages = processExternalCSS();

        // Process picture elements
        clone.querySelectorAll('picture').forEach(picture => {
            picture.querySelectorAll('source').forEach(source => {
                if (source.srcset) {
                    const absoluteSrcset = source.srcset.split(',').map(src => {
                        const [url, size] = src.trim().split(/\s+/);
                        return `${toAbsoluteUrl(url)} ${size || ''}`.trim();
                    }).join(', ');
                    source.setAttribute('srcset', absoluteSrcset);
                }
            });
        });

        // Process standard images
        clone.querySelectorAll('img').forEach(img => {
            // Preserve dimensions
            if (img.width) img.setAttribute('width', img.width);
            if (img.height) img.setAttribute('height', img.height);

            // Convert src/srcset
            if (img.src) img.src = toAbsoluteUrl(img.src);
            if (img.srcset) {
                img.srcset = img.srcset.split(',').map(src => {
                    const [url, size] = src.trim().split(/\s+/);
                    return `${toAbsoluteUrl(url)} ${size || ''}`.trim();
                }).join(', ');
            }

            // Add decoding attribute for performance
            img.setAttribute('decoding', 'async');
        });

        // Process SVGs
        clone.querySelectorAll('svg').forEach(svg => {
            processSVG(svg);
        });

        // Apply background images from external CSS
        backgroundImages.forEach((imageUrl, selector) => {
            try {
                const elements = clone.querySelectorAll(selector);
                elements.forEach(el => {
                    el.style.backgroundImage = `url('${imageUrl}')`;
                });
            } catch (e) {
                // Skip invalid selectors
            }
        });

        return clone;
    }

    // Function to get essential styles
    function getEssentialStyles(element) {
        const computedStyle = window.getComputedStyle(element);
        const essentialProperties = [
            // Layout
            'display', 'position', 'width', 'height', 'margin', 'padding',
            // Text formatting
            'font-size', 'font-weight', 'text-align', 'color',
            // Backgrounds
            'background-color',
            // Borders
            'border', 'border-radius',
            // Tables
            'border-collapse', 'border-spacing',
            // Flexbox essentials
            'flex-direction', 'justify-content', 'align-items'
        ];

        let styles = '';
        essentialProperties.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
                styles += `${prop}: ${value}; `;
            }
        });

        return styles.trim();
    }

    // Function to process styles
    function processStyles(element) {
        const clone = element.cloneNode(true);

        // Process all elements
        const allElements = clone.getElementsByTagName('*');
        for (let el of allElements) {
            const essentialStyles = getEssentialStyles(el);
            if (essentialStyles) {
                // Combine with existing inline styles if present
                const existingStyle = el.getAttribute('style') || '';
                el.setAttribute('style', `${existingStyle}; ${essentialStyles}`.trim());
            }
        }

        // Add basic CSS in <style> tag
        const basicCSS = `
            * { box-sizing: border-box; }
            table { border-collapse: collapse; }
            td, th { padding: 8px; }
            img { max-width: 100%; height: auto; }
        `;

        return {
            element: clone,
            css: basicCSS
        };
    }

    function showNotification(message, duration = 2000) {
        const div = document.createElement('div');
        div.textContent = message;
        div.style.position = 'fixed';
        div.style.top = '10px';
        div.style.right = '10px';
        div.style.padding = '10px';
        div.style.backgroundColor = '#333';
        div.style.color = '#fff';
        div.style.borderRadius = '5px';
        div.style.zIndex = '10001';
        document.body.appendChild(div);
        setTimeout(() => document.body.removeChild(div), duration);
    }

    function deactivateHighlighter() {
        isActive = false;
        overlay.style.display = 'none';
        document.body.style.cursor = 'default';
        showNotification('Element highlighter deactivated');
        window.focus(); // Ensure window has focus after deactivation
    }

    function activateHighlighter() {
        isActive = true;
        overlay.style.display = 'block';
        document.body.style.cursor = 'crosshair';
        showNotification('Element highlighter activated');

        // Force focus to the window/document
        window.focus();
        document.body.focus();

        // Create and remove a temporary button to ensure window focus
        const tempButton = document.createElement('button');
        tempButton.style.position = 'fixed';
        tempButton.style.top = '-9999px';
        document.body.appendChild(tempButton);
        tempButton.focus();
        document.body.removeChild(tempButton);
    }

    function toggleHighlighter() {
        if (isDownloading) return;

        if (isActive) {
            deactivateHighlighter();
        } else {
            activateHighlighter();
        }
    }

    function downloadElement(element, fileName) {
        // Process images first (using Phase 2 code)
        const withImages = processImages(element);

        // Then process styles
        const {element: processed, css: basicCSS} = processStyles(withImages);

        const content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${document.title}</title>
    <style>
        ${basicCSS}
    </style>
    <!--
    Source URL: ${window.location.href}
    Captured Element: ${element.tagName.toLowerCase()}
    Capture Date: ${new Date().toISOString()}
    Processing: Images and essential styles preserved
    -->
</head>
<body>
    ${processed.outerHTML}
</body>
</html>`;

        try {
            const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;

            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);

            showNotification('Element downloaded with preserved styles');
            return true;
        } catch (error) {
            console.error('Download failed:', error);
            showNotification('Failed to download element');
            return false;
        }
    }

    function handleMouseMove(e) {
        if (!isActive || isDownloading) return;

        currentElement = e.target;
        const rect = currentElement.getBoundingClientRect();

        overlay.style.top = window.scrollY + rect.top + 'px';
        overlay.style.left = window.scrollX + rect.left + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
    }

    function handleClick(e) {
        if (!isActive || !currentElement || isDownloading) return;

        e.preventDefault();
        e.stopPropagation();

        isDownloading = true;

        const defaultFileName = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        let userFileName = window.prompt('Enter file name:', defaultFileName);

        if (userFileName === null) {
            isDownloading = false;
            return;
        }

        userFileName = userFileName.trim();
        if (userFileName === '') userFileName = defaultFileName;

        const downloadSuccess = downloadElement(currentElement, userFileName);

        if (downloadSuccess) {
            deactivateHighlighter();
        }

        isDownloading = false;
    }

    function handleKeyPress(e) {
        // Check for Escape key regardless of isActive state
        if (e.key === 'Escape') {
            if (isActive) {
                isDownloading = false;
                deactivateHighlighter();
                e.preventDefault(); // Prevent default Escape behavior
                e.stopPropagation(); // Stop event bubbling
            }
        }
    }

    // Add event listeners to both document and window for better key capture
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyPress, true); // Added capture phase
    window.addEventListener('keydown', handleKeyPress, true); // Added window listener

    // Register menu command
    GM_registerMenuCommand('Toggle Element Highlighter', toggleHighlighter);
})();