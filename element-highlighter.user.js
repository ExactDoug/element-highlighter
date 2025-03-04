// ==UserScript==
// @name         Element Highlighter and Downloader
// @namespace    http://exactpartners.com/
// @version      0.4
// @description  Highlight and download webpage elements with simplified CSS
// @author       ExactDoug
// @match        *://*/*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    /**
     * URL Utilities Module
     * Handles all URL-related operations including converting relative URLs to absolute
     */
    const URLUtils = {
        /**
         * Converts a relative URL to an absolute URL
         * @param {string} relativeUrl - The relative URL to convert
         * @param {string} baseUrl - The base URL to use for conversion (defaults to current page)
         * @returns {string} - The absolute URL
         */
        toAbsoluteUrl(relativeUrl, baseUrl = window.location.href) {
            if (!relativeUrl) return '';
            if (relativeUrl.match(/^(https?:)?\/\//i)) return relativeUrl; // Already absolute
            if (relativeUrl.startsWith('data:')) return relativeUrl;
            if (relativeUrl.startsWith('mailto:')) return relativeUrl;
            if (relativeUrl.startsWith('tel:')) return relativeUrl;

            try {
                // Create URL object from base
                const base = new URL(baseUrl);

                // Handle different relative URL formats
                if (relativeUrl.startsWith('/')) {
                    // Root-relative URL
                    if (relativeUrl.startsWith('//')) {
                        return `${base.protocol}${relativeUrl}`;
                    }
                    // Site-root-relative URL
                    return `${base.origin}${relativeUrl}`;
                }

                // Handle ../ and ./ paths
                if (relativeUrl.startsWith('.')) {
                    let url = new URL(relativeUrl, baseUrl);
                    return url.href;
                }

                // Regular relative URL
                let url = new URL(relativeUrl, baseUrl);
                return url.href;
            } catch (e) {
                console.error('Error converting URL:', relativeUrl, e);
                return relativeUrl;
            }
        }
    };

    /**
     * Element Processor Module
     * Handles processing of HTML elements for download
     */
    const ElementProcessor = {
        /**
         * Processes links in an element to make them absolute
         * @param {Element} element - The element to process
         * @param {string} baseUrl - The base URL for conversion
         */
        processLinks(element, baseUrl = window.location.href) {
            // Convert href attributes
            element.querySelectorAll('a[href]').forEach(link => {
                try {
                    const href = link.getAttribute('href');
                    if (href) {
                        link.setAttribute('href', URLUtils.toAbsoluteUrl(href, baseUrl));
                    }
                } catch (e) {
                    console.error('Error processing link:', link, e);
                }
            });

            // Convert form actions
            element.querySelectorAll('form[action]').forEach(form => {
                try {
                    const action = form.getAttribute('action');
                    if (action) {
                        form.setAttribute('action', URLUtils.toAbsoluteUrl(action, baseUrl));
                    }
                } catch (e) {
                    console.error('Error processing form action:', form, e);
                }
            });
        },

        /**
         * Extracts background images from external CSS
         * @returns {Map} - Map of selectors to image URLs
         */
        processExternalCSS() {
            const styleSheets = Array.from(document.styleSheets);
            const backgroundImages = new Map();

            styleSheets.forEach(sheet => {
                try {
                    const rules = Array.from(sheet.cssRules || []);
                    rules.forEach(rule => {
                        if (rule.style && rule.style.backgroundImage) {
                            const urlMatch = rule.style.backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
                            if (urlMatch) {
                                backgroundImages.set(rule.selectorText, URLUtils.toAbsoluteUrl(urlMatch[1]));
                            }
                        }
                    });
                } catch (e) {
                    // Skip cross-origin stylesheets
                }
            });

            return backgroundImages;
        },

        /**
         * Processes SVG elements to ensure correct rendering
         * @param {SVGElement} svg - The SVG element to process
         * @returns {SVGElement} - The processed SVG element
         */
        processSVG(svg) {
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

                    finalHeight = toPixels(dimensions.attribute.height, dimensions.parent.height) ||
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
                    this.processSVG(nestedSvg);
                });

                // Process any image elements
                svg.querySelectorAll('image').forEach(image => {
                    const href = image.getAttribute('href') || image.getAttribute('xlink:href');
                    if (href) {
                        image.setAttribute('href', URLUtils.toAbsoluteUrl(href));
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
        },

        /**
         * Processes images in an element to make them absolute
         * @param {Element} element - The element to process
         * @returns {Element} - The processed element
         */
        processImages(element) {
            const clone = element.cloneNode(true);
            const backgroundImages = this.processExternalCSS();

            // Process picture elements
            clone.querySelectorAll('picture').forEach(picture => {
                picture.querySelectorAll('source').forEach(source => {
                    if (source.srcset) {
                        const absoluteSrcset = source.srcset.split(',').map(src => {
                            const [url, size] = src.trim().split(/\s+/);
                            return `${URLUtils.toAbsoluteUrl(url)} ${size || ''}`.trim();
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
                if (img.src) img.src = URLUtils.toAbsoluteUrl(img.src);
                if (img.srcset) {
                    img.srcset = img.srcset.split(',').map(src => {
                        const [url, size] = src.trim().split(/\s+/);
                        return `${URLUtils.toAbsoluteUrl(url)} ${size || ''}`.trim();
                    }).join(', ');
                }

                // Add decoding attribute for performance
                img.setAttribute('decoding', 'async');
            });

            // Process SVGs
            clone.querySelectorAll('svg').forEach(svg => {
                this.processSVG(svg);
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
        },

        /**
         * Gets essential styles from an element
         * @param {Element} element - The element to process
         * @returns {string} - CSS string of essential styles
         */
        getEssentialStyles(element) {
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
        },

        /**
         * Processes styles in an element
         * @param {Element} element - The element to process
         * @returns {Object} - Object containing processed element and basic CSS
         */
        processStyles(element) {
            const clone = element.cloneNode(true);

            // Process all elements
            const allElements = clone.getElementsByTagName('*');
            for (let el of allElements) {
                const essentialStyles = this.getEssentialStyles(el);
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
    };

    /**
     * UI Module
     * Handles user interface elements and interactions
     */
    const UIManager = {
        /**
         * Creates and manages the overlay element
         */
        overlay: null,

        /**
         * Creates the selection overlay
         * @returns {HTMLElement} - The created overlay element
         */
        createOverlay() {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.pointerEvents = 'none';
            overlay.style.backgroundColor = 'rgba(0, 123, 255, 0.2)';
            overlay.style.display = 'none';
            overlay.style.zIndex = '10000';
            document.body.appendChild(overlay);
            this.overlay = overlay;
            return overlay;
        },

        /**
         * Shows a notification message
         * @param {string} message - The message to display
         * @param {number} duration - How long to show the message (ms)
         */
        showNotification(message, duration = 2000) {
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
    };

    /**
     * Highlighter Module
     * Manages the element highlighting functionality
     */
    const Highlighter = {
        /**
         * State of the highlighter
         */
        isActive: false,
        currentElement: null,
        isDownloading: false,

        /**
         * Initializes the highlighter
         */
        init() {
            UIManager.createOverlay();
            this.setupEventListeners();
            GM_registerMenuCommand('Toggle Element Highlighter', () => this.toggleHighlighter());
        },

        /**
         * Sets up event listeners
         */
        setupEventListeners() {
            document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            document.addEventListener('click', (e) => this.handleClick(e));
            document.addEventListener('keydown', (e) => this.handleKeyPress(e), true);
            window.addEventListener('keydown', (e) => this.handleKeyPress(e), true);
        },

        /**
         * Deactivates the highlighter
         */
        deactivateHighlighter() {
            this.isActive = false;
            UIManager.overlay.style.display = 'none';
            document.body.style.cursor = 'default';
            UIManager.showNotification('Element highlighter deactivated');
            window.focus(); // Ensure window has focus after deactivation
        },

        /**
         * Activates the highlighter
         */
        activateHighlighter() {
            this.isActive = true;
            UIManager.overlay.style.display = 'block';
            document.body.style.cursor = 'crosshair';
            UIManager.showNotification('Element highlighter activated');

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
        },

        /**
         * Toggles the highlighter state
         */
        toggleHighlighter() {
            if (this.isDownloading) return;

            if (this.isActive) {
                this.deactivateHighlighter();
            } else {
                this.activateHighlighter();
            }
        },

        /**
         * Handles mouse movement to highlight elements
         * @param {MouseEvent} e - The mouse event
         */
        handleMouseMove(e) {
            if (!this.isActive || this.isDownloading) return;

            this.currentElement = e.target;
            const rect = this.currentElement.getBoundingClientRect();

            UIManager.overlay.style.top = window.scrollY + rect.top + 'px';
            UIManager.overlay.style.left = window.scrollX + rect.left + 'px';
            UIManager.overlay.style.width = rect.width + 'px';
            UIManager.overlay.style.height = rect.height + 'px';
        },

        /**
         * Handles clicks to select elements
         * @param {MouseEvent} e - The mouse event
         */
        handleClick(e) {
            if (!this.isActive || !this.currentElement || this.isDownloading) return;

            e.preventDefault();
            e.stopPropagation();

            this.isDownloading = true;

            const defaultFileName = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            let userFileName = window.prompt('Enter file name:', defaultFileName);

            if (userFileName === null) {
                this.isDownloading = false;
                return;
            }

            userFileName = userFileName.trim();
            if (userFileName === '') userFileName = defaultFileName;

            const downloadSuccess = Downloader.downloadElement(this.currentElement, userFileName);

            if (downloadSuccess) {
                this.deactivateHighlighter();
            }

            this.isDownloading = false;
        },

        /**
         * Handles keyboard presses
         * @param {KeyboardEvent} e - The keyboard event
         */
        handleKeyPress(e) {
            // Check for Escape key regardless of isActive state
            if (e.key === 'Escape') {
                if (this.isActive) {
                    this.isDownloading = false;
                    this.deactivateHighlighter();
                    e.preventDefault(); // Prevent default Escape behavior
                    e.stopPropagation(); // Stop event bubbling
                }
            }
        }
    };

    /**
     * Downloader Module
     * Handles downloading of selected elements
     */
    const Downloader = {
        /**
         * Downloads an element as an HTML file
         * @param {Element} element - The element to download
         * @param {string} fileName - The name of the file
         * @returns {boolean} - Whether the download was successful
         */
        downloadElement(element, fileName) {
            try {
                // Create a clone to avoid modifying the original
                const clone = element.cloneNode(true);

                // Process all relative links in the clone
                ElementProcessor.processLinks(clone, window.location.href);

                // Process images (including SVG handling)
                const withImages = ElementProcessor.processImages(clone);

                // Process styles
                const { element: processed, css: basicCSS } = ElementProcessor.processStyles(withImages);

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
    Processing: Images, styles, and links converted to absolute URLs
    -->
</head>
<body>
    ${processed.outerHTML}
</body>
</html>`;

                const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;

                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(url);

                UIManager.showNotification('Element downloaded with preserved styles and absolute links');
                return true;
            } catch (error) {
                console.error('Download failed:', error);
                UIManager.showNotification('Failed to download element');
                return false;
            }
        }
    };

    // Initialize the highlighter
    Highlighter.init();
})();