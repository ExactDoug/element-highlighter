// ==UserScript==
// @name         Element Highlighter and Downloader
// @namespace    http://exactpartners.com/
// @version      0.3
// @description  Highlight and download webpage elements with simplified CSS
// @author       ExactDoug
// @match        *://*/*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
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
            // Helper function to determine if SVG is a header/masthead logo
            function isHeaderLogo(svg) {
                const parent = svg.parentElement;
                return (
                    // Check common header/masthead indicators
                    (parent.closest('header') ||
                        parent.closest('[role="banner"]') ||
                        parent.closest('.navbar') ||
                        parent.closest('#navbar') ||
                        parent.closest('[class*="header"]') ||
                        parent.closest('[class*="nav"]')) &&
                    // Additional logo indicators
                    (svg.classList.toString().toLowerCase().includes('logo') ||
                        parent.classList.toString().toLowerCase().includes('logo') ||
                        (parent.tagName === 'A' && parent.href && parent.href.includes('/home')) ||
                        parent.getAttribute('aria-label')?.toLowerCase().includes('logo') ||
                        parent.getAttribute('alt')?.toLowerCase().includes('logo'))
                );
            }

            // Early handling for header logos
            if (isHeaderLogo(svg)) {
                // Get parent header/container dimensions
                const headerHeight = svg.closest('header, [role="banner"], .navbar, #navbar')?.getBoundingClientRect().height || 64;

                // Calculate logo dimensions (typically 50-75% of header height)
                const targetHeight = Math.min(headerHeight * 0.6, 40); // Cap at 40px
                const currentRect = svg.getBoundingClientRect();
                const aspectRatio = currentRect.width / currentRect.height;
                const targetWidth = targetHeight * aspectRatio;

                // Apply dimensions
                svg.style.height = `${targetHeight}px`;
                svg.style.width = `${targetWidth}px`;
                svg.style.minHeight = `${targetHeight}px`; // Prevent collapse
                svg.style.minWidth = `${targetWidth}px`;

                // Ensure viewBox
                if (!svg.getAttribute('viewBox') && currentRect.width && currentRect.height) {
                    svg.setAttribute('viewBox', `0 0 ${currentRect.width} ${currentRect.height}`);
                }

                return svg;
            }

            // Rest of the existing SVG processing code for non-icon SVGs...
            // Helper function to convert various units to pixels
            function toPixels(value, parentDimension = 0) {
                if (!value) return null;
                // Remove all spaces
                value = value.trim();

                // Handle percentages
                if (value.endsWith('%')) {
                    return (parseFloat(value) / 100) * parentDimension;
                }

                // Handle px
                if (value.endsWith('px')) {
                    return parseFloat(value);
                }

                // Handle rem/em
                if (value.endsWith('rem')) {
                    return parseFloat(value) * parseFloat(getComputedStyle(document.documentElement).fontSize);
                }
                if (value.endsWith('em')) {
                    return parseFloat(value) * parseFloat(getComputedStyle(svg.parentElement).fontSize);
                }

                // Handle raw numbers
                if (!isNaN(value)) {
                    return parseFloat(value);
                }

                return null;
            }

            // Get parent dimensions
            const parentRect = svg.parentElement.getBoundingClientRect();
            const parentStyle = window.getComputedStyle(svg.parentElement);
            const computedStyle = window.getComputedStyle(svg);
            const svgRect = svg.getBoundingClientRect();

            // Gather all possible dimension sources
            const dimensions = {
                // Direct attributes
                attribute: {
                    width: svg.getAttribute('width'),
                    height: svg.getAttribute('height')
                },
                // Inline styles
                style: {
                    width: svg.style.width,
                    height: svg.style.height
                },
                // Computed styles
                computed: {
                    width: computedStyle.width,
                    height: computedStyle.height
                },
                // Bounding client rect
                rect: {
                    width: svgRect.width,
                    height: svgRect.height
                },
                // Parent dimensions
                parent: {
                    width: parentRect.width,
                    height: parentRect.height
                },
                // ViewBox if present
                viewBox: svg.getAttribute('viewBox')?.split(' ').map(Number)
            };

            // Determine if SVG is meant to be responsive
            const isResponsive = computedStyle.width.includes('%') ||
                parentStyle.display === 'flex' ||
                parentStyle.display === 'grid' ||
                svg.style.width === '100%' ||
                svg.classList.contains('w-auto') ||
                svg.classList.contains('h-auto');

            // Get actual dimensions
            let finalWidth = null;
            let finalHeight = null;

            if (isResponsive) {
                // Calculate responsive dimensions based on parent
                if (dimensions.rect.width && dimensions.rect.height) {
                    const aspectRatio = dimensions.rect.width / dimensions.rect.height;
                    // Set width as percentage of parent
                    const widthPercent = (dimensions.rect.width / dimensions.parent.width) * 100;
                    finalWidth = `${widthPercent}%`;
                    // Set height using aspect ratio
                    finalHeight = dimensions.rect.height;
                }
            } else {
                // Try to get explicit dimensions in this priority order
                finalWidth = toPixels(dimensions.attribute.width, dimensions.parent.width) ||
                    toPixels(dimensions.style.width, dimensions.parent.width) ||
                    toPixels(dimensions.computed.width, dimensions.parent.width) ||
                    dimensions.rect.width ||
                    (dimensions.viewBox && dimensions.viewBox[2]);

                toPixels(dimensions.style.height, dimensions.parent.height) ||
                    toPixels(dimensions.computed.height, dimensions.parent.height) ||
                    dimensions.rect.height ||
                    (dimensions.viewBox && dimensions.viewBox[3]);
            }

            // Ensure we have valid dimensions
            if (!finalWidth || !finalHeight) {
                // Fall back to actual rendered dimensions
                finalWidth = dimensions.rect.width || 100;
                finalHeight = dimensions.rect.height || 100;
            }

            // Apply dimensions
            if (isResponsive) {
                if (typeof finalWidth === 'string' && finalWidth.endsWith('%')) {
                    svg.style.width = finalWidth;
                    svg.style.height = 'auto';
                } else {
                    // If we couldn't calculate percentage, maintain aspect ratio
                    svg.style.width = '100%';
                    svg.style.height = 'auto';
                }
            } else {
                svg.style.width = `${finalWidth}px`;
                svg.style.height = `${finalHeight}px`;
            }

            // Ensure viewBox exists
            if (!dimensions.viewBox && finalWidth && finalHeight) {
                svg.setAttribute('viewBox', `0 0 ${finalWidth} ${finalHeight}`);
            }

            // Ensure preserveAspectRatio is set appropriately
            if (!svg.hasAttribute('preserveAspectRatio')) {
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }

            // Process any nested SVG elements
            svg.querySelectorAll('svg').forEach(nestedSvg => {
                processSVG(nestedSvg);
            });

            // Process any image elements
            svg.querySelectorAll('image').forEach(image => {
                const href = image.getAttribute('href') || image.getAttribute('xlink:href');
                if (href) {
                    image.setAttribute('href', toAbsoluteUrl(href));
                }
            });

            // For debugging
            console.debug('SVG processed:', {
                isResponsive,
                dimensions,
                finalWidth,
                finalHeight
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
        const { element: processed, css: basicCSS } = processStyles(withImages);

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