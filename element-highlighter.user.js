// ==UserScript==
// @name         Element Highlighter and Downloader
// @namespace    http://exactpartners.com/
// @version      0.5
// @description  Highlight and download webpage elements with simplified CSS and multiple selection
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

                // Enforce maximum dimensions of 40x40 pixels for all SVGs
                const maxSize = 40;

                // Get the current dimensions (either calculated or from the element)
                let currentWidth = parseFloat(svg.style.width) || finalWidth || dimensions.rect.width || 40;
                let currentHeight = parseFloat(svg.style.height) || finalHeight || dimensions.rect.height || 40;

                // Remove any units if present
                if (typeof currentWidth === 'string') {
                    currentWidth = parseFloat(currentWidth);
                }
                if (typeof currentHeight === 'string') {
                    currentHeight = parseFloat(currentHeight);
                }

                // Calculate new dimensions while preserving aspect ratio
                let newWidth, newHeight;
                const aspectRatio = currentWidth / currentHeight;

                if (currentWidth > maxSize || currentHeight > maxSize) {
                    if (aspectRatio > 1) {
                        // Wider than tall
                        newWidth = maxSize;
                        newHeight = maxSize / aspectRatio;
                    } else {
                        // Taller than wide or square
                        newHeight = maxSize;
                        newWidth = maxSize * aspectRatio;
                    }

                    // Apply the size restriction
                    svg.style.width = `${newWidth}px`;
                    svg.style.height = `${newHeight}px`;
                    svg.style.maxWidth = `${maxSize}px`;
                    svg.style.maxHeight = `${maxSize}px`;
                }

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
         * The selection panel that displays selected elements
         */
        selectionPanel: null,

        /**
         * The download button for downloading all selected elements
         */
        downloadButton: null,

        /**
         * The clear button for clearing all selections
         */
        clearButton: null,

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
         * Creates the selection panel that shows selected elements
         * @returns {HTMLElement} - The created selection panel
         */
        createSelectionPanel() {
            // Create panel container
            const panel = document.createElement('div');
            panel.id = 'elementHighlighterPanel';
            panel.style.position = 'fixed';
            panel.style.top = '10px';
            panel.style.right = '10px';
            panel.style.width = '300px';
            panel.style.maxHeight = '80vh';
            panel.style.overflowY = 'auto';
            panel.style.backgroundColor = '#fff';
            panel.style.border = '1px solid #ccc';
            panel.style.borderRadius = '5px';
            panel.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            panel.style.zIndex = '10001';
            panel.style.padding = '10px';
            panel.style.display = 'none';
            panel.style.fontFamily = 'Arial, sans-serif';
            panel.style.fontSize = '14px';

            // Create header
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '10px';
            header.style.padding = '5px 0';
            header.style.borderBottom = '1px solid #eee';

            const title = document.createElement('h3');
            title.textContent = 'Selected Elements';
            title.style.margin = '0';
            title.style.fontSize = '16px';
            title.style.fontWeight = 'bold';

            // Create minimize button
            const minimizeBtn = document.createElement('button');
            minimizeBtn.textContent = '−';
            minimizeBtn.style.background = 'none';
            minimizeBtn.style.border = 'none';
            minimizeBtn.style.fontSize = '16px';
            minimizeBtn.style.cursor = 'pointer';
            minimizeBtn.style.padding = '0 5px';
            minimizeBtn.title = 'Minimize panel';

            minimizeBtn.addEventListener('click', () => {
                const content = panel.querySelector('#elementHighlighterPanelContent');
                const buttonContainer = panel.querySelector('#elementHighlighterButtonContainer');

                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    buttonContainer.style.display = 'flex';
                    minimizeBtn.textContent = '−';
                    minimizeBtn.title = 'Minimize panel';
                } else {
                    content.style.display = 'none';
                    buttonContainer.style.display = 'none';
                    minimizeBtn.textContent = '+';
                    minimizeBtn.title = 'Expand panel';
                }
            });

            header.appendChild(title);
            header.appendChild(minimizeBtn);
            panel.appendChild(header);

            // Create content container
            const content = document.createElement('div');
            content.id = 'elementHighlighterPanelContent';
            content.style.marginBottom = '10px';
            panel.appendChild(content);

            // Create button container
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'elementHighlighterButtonContainer';
            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'space-between';
            buttonContainer.style.gap = '5px';

            // Create download button
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download All';
            downloadBtn.style.backgroundColor = '#4CAF50';
            downloadBtn.style.color = 'white';
            downloadBtn.style.border = 'none';
            downloadBtn.style.padding = '8px 12px';
            downloadBtn.style.borderRadius = '4px';
            downloadBtn.style.cursor = 'pointer';
            downloadBtn.style.flex = '1';
            downloadBtn.style.fontWeight = 'bold';
            this.downloadButton = downloadBtn;

            // Create clear button
            const clearBtn = document.createElement('button');
            clearBtn.textContent = 'Clear All';
            clearBtn.style.backgroundColor = '#f44336';
            clearBtn.style.color = 'white';
            clearBtn.style.border = 'none';
            clearBtn.style.padding = '8px 12px';
            clearBtn.style.borderRadius = '4px';
            clearBtn.style.cursor = 'pointer';
            clearBtn.style.flex = '1';
            this.clearButton = clearBtn;

            buttonContainer.appendChild(downloadBtn);
            buttonContainer.appendChild(clearBtn);
            panel.appendChild(buttonContainer);

            // Make panel draggable
            let isDragging = false;
            let offsetX, offsetY;

            header.style.cursor = 'move';
            header.addEventListener('mousedown', (e) => {
                if (e.target === minimizeBtn) return;

                isDragging = true;
                offsetX = e.clientX - panel.getBoundingClientRect().left;
                offsetY = e.clientY - panel.getBoundingClientRect().top;
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                panel.style.left = (e.clientX - offsetX) + 'px';
                panel.style.top = (e.clientY - offsetY) + 'px';
                panel.style.right = 'auto';
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
            });

            document.body.appendChild(panel);
            this.selectionPanel = panel;

            return panel;
        },

        /**
         * Updates the selection panel with the current selected elements
         * @param {Array} selectedElements - Array of selected elements
         */
        updateSelectionPanel(selectedElements) {
            const content = this.selectionPanel.querySelector('#elementHighlighterPanelContent');
            content.innerHTML = '';

            if (selectedElements.length === 0) {
                const emptyMessage = document.createElement('p');
                emptyMessage.textContent = 'No elements selected';
                emptyMessage.style.color = '#999';
                emptyMessage.style.textAlign = 'center';
                emptyMessage.style.padding = '10px';
                content.appendChild(emptyMessage);

                // Hide the panel if there are no selected elements and highlighter is not active
                if (!Highlighter.isActive) {
                    this.selectionPanel.style.display = 'none';
                }

                return;
            }

            // Create element list
            const list = document.createElement('ul');
            list.style.listStyle = 'none';
            list.style.padding = '0';
            list.style.margin = '0';

            selectedElements.forEach((item, index) => {
                const listItem = document.createElement('li');
                listItem.style.padding = '8px';
                listItem.style.borderBottom = '1px solid #eee';
                listItem.style.display = 'flex';
                listItem.style.justifyContent = 'space-between';
                listItem.style.alignItems = 'center';

                // Create element info
                const elementInfo = document.createElement('div');
                elementInfo.style.flex = '1';
                elementInfo.style.overflow = 'hidden';
                elementInfo.style.textOverflow = 'ellipsis';
                elementInfo.style.whiteSpace = 'nowrap';

                const tagName = document.createElement('span');
                tagName.textContent = item.element.tagName.toLowerCase();
                tagName.style.fontWeight = 'bold';
                tagName.style.color = '#0066cc';

                const className = item.element.className ? `.${item.element.className.split(' ')[0]}` : '';
                const idName = item.element.id ? `#${item.element.id}` : '';

                const elementDesc = document.createElement('span');
                elementDesc.textContent = `${idName}${className}`;
                elementDesc.style.color = '#666';
                elementDesc.style.fontSize = '12px';

                elementInfo.appendChild(tagName);
                if (idName || className) {
                    elementInfo.appendChild(document.createTextNode(' '));
                    elementInfo.appendChild(elementDesc);
                }

                // Create highlight button
                const highlightBtn = document.createElement('button');
                highlightBtn.innerHTML = '👁️';
                highlightBtn.title = 'Highlight element';
                highlightBtn.style.background = 'none';
                highlightBtn.style.border = 'none';
                highlightBtn.style.cursor = 'pointer';
                highlightBtn.style.padding = '0 5px';
                highlightBtn.style.fontSize = '14px';

                highlightBtn.addEventListener('click', () => {
                    SelectionManager.highlightSelectedElement(index);
                });

                // Create remove button
                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '✕';
                removeBtn.title = 'Remove from selection';
                removeBtn.style.background = 'none';
                removeBtn.style.border = 'none';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.padding = '0 5px';
                removeBtn.style.fontSize = '14px';
                removeBtn.style.color = '#f44336';

                removeBtn.addEventListener('click', () => {
                    SelectionManager.removeElementFromSelection(index);
                });

                listItem.appendChild(elementInfo);
                listItem.appendChild(highlightBtn);
                listItem.appendChild(removeBtn);
                list.appendChild(listItem);

                // Add hover effect
                listItem.addEventListener('mouseenter', () => {
                    listItem.style.backgroundColor = '#f5f5f5';
                });

                listItem.addEventListener('mouseleave', () => {
                    listItem.style.backgroundColor = '';
                });
            });

            content.appendChild(list);

            // Show selection count in title
            const title = this.selectionPanel.querySelector('h3');
            title.textContent = `Selected Elements (${selectedElements.length})`;

            // Show the panel if it's hidden
            this.selectionPanel.style.display = 'block';
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
        },

        /**
         * Hides the selection panel
         */
        hideSelectionPanel() {
            if (this.selectionPanel) {
                this.selectionPanel.style.display = 'none';
            }
        }
    };

    /**
     * Selection Manager Module
     * Handles the management of selected elements
     */
    const SelectionManager = {
        /**
         * Array of selected elements with metadata
         */
        selectedElements: [],

        /**
         * The currently highlighted element from the selection panel
         */
        highlightedElement: null,

        /**
         * The current highlight overlay for selected elements
         */
        highlightOverlay: null,

        /**
         * Handler for highlight scroll events
         */
        highlightScrollHandler: null,

        /**
         * Map to store scroll handlers for each indicator
         * This will help us manage multiple indicator positions
         */
        indicatorScrollHandlers: new Map(),

        /**
         * Observer for tracking element position changes
         * (in case of dynamic page content)
         */
        resizeObserver: null,

        /**
         * Initializes the selection manager
         */
        init() {
            // Create the highlight overlay for selection panel highlighting
            this.createHighlightOverlay();
            // Initialize resize observer
            this.initResizeObserver();
        },

        /**
         * Creates the highlight overlay for selection panel interactions
         */
        createHighlightOverlay() {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.pointerEvents = 'none';
            overlay.style.transition = 'all 0.05s ease';  // Smooth transition when scrolling
            overlay.style.backgroundColor = 'rgba(255, 193, 7, 0.3)';
            overlay.style.border = '2px dashed #FFC107';
            overlay.style.display = 'none';
            overlay.style.zIndex = '9999';
            document.body.appendChild(overlay);
            this.highlightOverlay = overlay;
        },

        /**
         * Initialize the ResizeObserver for tracking element movements
         */
        initResizeObserver() {
            if (typeof ResizeObserver !== 'undefined') {
                this.resizeObserver = new ResizeObserver(entries => {
                    this.updateAllIndicatorPositions();
                });
            } else {
                console.warn('ResizeObserver not supported in this browser. Some element tracking features may not work correctly.');
            }
        },

        /**
         * Add an element to the selection
         * @param {Element} element - The element to add
         * @returns {boolean} - Whether the element was added successfully
         */
        addElementToSelection(element) {
            // Check if element already exists in selection
            const exists = this.selectedElements.some(item => item.element === element);
            if (exists) {
                UIManager.showNotification('Element already selected');
                return false;
            }

            // Generate a unique ID for the element
            const id = `element-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Add temporary visual feedback
            this.addSelectionIndicator(element, id);

            // Add to selection array
            this.selectedElements.push({
                element: element,
                id: id
            });

            // Update the selection panel
            UIManager.updateSelectionPanel(this.selectedElements);

            return true;
        },

        /**
         * Adds a visual indicator to a selected element
         * @param {Element} element - The element to mark
         * @param {string} id - Unique ID for the element
         */
        addSelectionIndicator(element, id) {
            // Calculate position
            const rect = element.getBoundingClientRect();

            // Create indicator
            const indicator = document.createElement('div');
            indicator.className = 'element-highlighter-indicator element-highlighter-indicator-' + id;
            indicator.dataset.forElement = id;
            indicator.style.position = 'absolute';  // Changed from fixed to absolute for proper scrolling
            indicator.style.top = (window.scrollY + rect.top) + 'px';
            indicator.style.left = (window.scrollX + rect.left) + 'px';
            indicator.style.width = rect.width + 'px';
            indicator.style.height = rect.height + 'px';
            indicator.style.transition = 'all 0.05s ease';  // Smooth transition for scrolling
            indicator.style.border = '2px solid #28a745';
            indicator.style.pointerEvents = 'none';
            indicator.style.zIndex = '9998';
            indicator.style.boxSizing = 'border-box';

            // Store original element's position data for smoother updates
            indicator.dataset.elementTop = rect.top;
            indicator.dataset.elementLeft = rect.left;
            indicator.dataset.elementWidth = rect.width;
            indicator.dataset.elementHeight = rect.height;

            // Add number badge
            const badge = document.createElement('div');
            badge.style.position = 'absolute';
            badge.style.top = '-10px';
            badge.style.right = '-10px';
            badge.style.transform = 'translateZ(0)';  // Hardware acceleration
            badge.style.willChange = 'transform';     // Hint for browser optimization
            badge.className = 'element-highlighter-badge';
            badge.style.width = '20px';
            badge.style.height = '20px';
            badge.style.borderRadius = '50%';
            badge.style.backgroundColor = '#28a745';
            badge.style.color = 'white';
            badge.style.display = 'flex';
            badge.style.justifyContent = 'center';
            badge.style.alignItems = 'center';
            badge.style.fontSize = '12px';
            badge.style.fontWeight = 'bold';
            badge.textContent = this.selectedElements.length + 1;

            indicator.appendChild(badge);
            document.body.appendChild(indicator);

            // Update selection indicator when page scrolls
            const updateIndicatorPosition = () => {
                const newRect = element.getBoundingClientRect();

                // Only update if element is still in the DOM
                if (document.body.contains(element)) {
                    // Update dataset values for reference
                    indicator.dataset.elementTop = newRect.top;
                    indicator.dataset.elementLeft = newRect.left;
                    indicator.dataset.elementWidth = newRect.width;
                    indicator.dataset.elementHeight = newRect.height;

                    // Calculate actual position accounting for scroll
                    indicator.style.top = (window.scrollY + newRect.top) + 'px';
                    indicator.style.left = (window.scrollX + newRect.left) + 'px';
                    indicator.style.width = newRect.width + 'px';
                    indicator.style.height = newRect.height + 'px';
                }
            };

            // Observe the element for size/position changes
            if (this.resizeObserver) {
                try {
                    this.resizeObserver.observe(element);
                } catch (e) {
                    console.warn('Failed to observe element:', e);
                }
            }

            // Add scroll event listener
            window.addEventListener('scroll', updateIndicatorPosition);

            // Store scroll handler reference to remove it later
            indicator.scrollHandler = updateIndicatorPosition;
            this.indicatorScrollHandlers.set(id, updateIndicatorPosition);
        },

        /**
         * Update positions of all indicators based on their elements
         * Called by ResizeObserver and can be called manually
         */
        updateAllIndicatorPositions() {
            this.selectedElements.forEach(item => {
                const element = item.element;
                const id = item.id;
                const indicator = document.querySelector(`.element-highlighter-indicator[data-for-element="${id}"]`);

                if (indicator && document.body.contains(element)) {
                    const rect = element.getBoundingClientRect();

                    // Update position with scroll offset
                    indicator.style.top = (window.scrollY + rect.top) + 'px';
                    indicator.style.left = (window.scrollX + rect.left) + 'px';
                    indicator.style.width = rect.width + 'px';
                    indicator.style.height = rect.height + 'px';

                    // Store updated values
                    indicator.dataset.elementTop = rect.top;
                    indicator.dataset.elementLeft = rect.left;
                }
            });
        },

        /**
         * Remove an element from the selection by index
         * @param {number} index - Index of the element in the selectedElements array
         */
        removeElementFromSelection(index) {
            if (index < 0 || index >= this.selectedElements.length) return;

            // Get element ID
            const id = this.selectedElements[index].id;

            // Unobserve the element if using ResizeObserver
            if (this.resizeObserver) {
                try {
                    this.resizeObserver.unobserve(this.selectedElements[index].element);
                } catch (e) {
                    // Element might already be gone from DOM
                }
            }

            // Remove indicator
            const indicator = document.querySelector(`.element-highlighter-indicator[data-for-element="${id}"]`);
            if (indicator) {
                // Remove scroll handler
                if (indicator.scrollHandler) {
                    window.removeEventListener('scroll', indicator.scrollHandler);
                }
                document.body.removeChild(indicator);
            }

            // Remove from handlers map
            this.indicatorScrollHandlers.delete(id);

            // Remove from array
            this.selectedElements.splice(index, 1);

            // Update remaining indicators (badge numbers)
            const indicators = document.querySelectorAll('.element-highlighter-indicator');
            indicators.forEach((ind, i) => {
                const badge = ind.querySelector('div');
                if (badge) {
                    badge.textContent = i + 1;
                }
            });

            // Update the selection panel
            UIManager.updateSelectionPanel(this.selectedElements);
        },

        /**
         * Clears all selected elements
         */
        clearSelection() {
            // Remove all indicators
            const indicators = document.querySelectorAll('.element-highlighter-indicator');
            indicators.forEach(indicator => {
                // Remove scroll handler
                if (indicator.scrollHandler) {
                    window.removeEventListener('scroll', indicator.scrollHandler);
                }
                document.body.removeChild(indicator);
            });

            // Disconnect ResizeObserver to stop observing all elements
            if (this.resizeObserver) {
                try {
                    this.resizeObserver.disconnect();
                } catch (e) {
                    // Observer might already be disconnected
                }
            }

            // Clear array
            this.selectedElements = [];

            // Clear the handlers map
            this.indicatorScrollHandlers.clear();

            // Hide highlight overlay if visible
            this.highlightOverlay.style.display = 'none';
            this.highlightedElement = null;

            // Update the selection panel
            UIManager.updateSelectionPanel(this.selectedElements);
        },

        /**
         * Highlights a selected element from the panel
         * @param {number} index - Index of the element to highlight
         */
        highlightSelectedElement(index) {
            if (index < 0 || index >= this.selectedElements.length) return;

            // If element has been removed from the DOM, remove from selection
            if (!document.body.contains(this.selectedElements[index].element)) {
                this.removeElementFromSelection(index);
                return;
            }

            const element = this.selectedElements[index].element;
            const rect = element.getBoundingClientRect();

            // Update highlight overlay
            this.highlightOverlay.style.top = (window.scrollY + rect.top) + 'px';
            this.highlightOverlay.style.left = (window.scrollX + rect.left) + 'px';
            this.highlightOverlay.style.width = rect.width + 'px';
            this.highlightOverlay.style.height = rect.height + 'px';
            this.highlightOverlay.style.display = 'block';

            // Scroll element into view if needed
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // Save reference to highlighted element
            this.highlightedElement = element;

            // Add scroll event handler to update overlay position
            const updatePosition = () => {
                if (!this.highlightedElement) return;

                const newRect = this.highlightedElement.getBoundingClientRect();
                this.highlightOverlay.style.top = (window.scrollY + newRect.top) + 'px';
                this.highlightOverlay.style.left = (window.scrollX + newRect.left) + 'px';
                this.highlightOverlay.style.width = newRect.width + 'px';
                this.highlightOverlay.style.height = newRect.height + 'px';
            };

            // Remove previous scroll handler if exists
            if (this.highlightScrollHandler) {
                window.removeEventListener('scroll', this.highlightScrollHandler);
            }

            // Add new scroll handler
            window.addEventListener('scroll', updatePosition);
            this.highlightScrollHandler = updatePosition;
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
        _scrollThrottleTimeout: null,

        /**
         * Prevents text selection on the entire page
         * @param {boolean} prevent - Whether to prevent or allow text selection
         */
        preventTextSelection(prevent) {
            if (prevent) {
                document.body.style.userSelect = 'none';
                document.body.style.webkitUserSelect = 'none';
                document.body.style.msUserSelect = 'none';
                document.body.style.mozUserSelect = 'none';
            } else {
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
                document.body.style.msUserSelect = '';
                document.body.style.mozUserSelect = '';
            }
        },

        /**
         * Initializes the highlighter
         */
        init() {
            UIManager.createOverlay();
            UIManager.createSelectionPanel();
            SelectionManager.init();
            this.setupEventListeners();
            this.setupMouseDownHandler();
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

            // Add specific Shift key prevention
            document.addEventListener('keydown', (e) => {
                if (this.isActive && e.key === 'Shift') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);

            // Prevent context menu when highlighter is active
            document.addEventListener('contextmenu', (e) => {
                if (this.isActive) {
                    e.preventDefault();
                    return false;
                }
            }, true);

            // Add a scroll event listener to update all indicator positions
            window.addEventListener('scroll', () => {
                if (this.isActive && SelectionManager.selectedElements.length > 0) {
                    // Use throttling to improve performance
                    if (!this._scrollThrottleTimeout) {
                        this._scrollThrottleTimeout = setTimeout(() => {
                            SelectionManager.updateAllIndicatorPositions();
                            this._scrollThrottleTimeout = null;
                        }, 16); // ~60fps
                    }
                }
            }, { passive: true });

            // Setup selection panel button listeners
            UIManager.downloadButton.addEventListener('click', () => {
                if (SelectionManager.selectedElements.length > 0) {
                    this.downloadSelectedElements();
                } else {
                    UIManager.showNotification('No elements selected for download');
                }
            });

            UIManager.clearButton.addEventListener('click', () => {
                SelectionManager.clearSelection();
                UIManager.showNotification('Selection cleared');
            });
        },

        /**
         * Handle mousedown events to prevent text selection at the source
         */
        setupMouseDownHandler() {
            document.addEventListener('mousedown', (e) => {
                if (this.isActive) {
                    if (e.shiftKey ||
                        e.target.closest('#elementHighlighterPanel') ||
                        e.target.closest('.element-highlighter-indicator')) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }, true);  // Use capture phase
        },

        /**
         * Deactivates the highlighter
         */
        deactivateHighlighter() {
            this.isActive = false;
            UIManager.overlay.style.display = 'none';
            document.body.style.cursor = 'default';
            this.preventTextSelection(false); // Re-enable text selection
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
            this.preventTextSelection(true); // Prevent text selection
            UIManager.showNotification('Element highlighter activated (use Shift+Click to select multiple elements)');

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

            // Prevent default behavior if Shift is pressed
            if (e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
            }

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
            // Ignore clicks on UI elements
            if (e.target.closest('#elementHighlighterPanel') ||
                e.target.closest('.element-highlighter-indicator')) {
                return;
            }

            if (!this.isActive || !this.currentElement || this.isDownloading) return;

            // Always prevent default behavior when highlighter is active
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Check if Shift key is pressed for multi-select
            if (e.shiftKey) {
                const added = SelectionManager.addElementToSelection(this.currentElement);
                if (added) {
                    UIManager.showNotification('Element added to selection');
                }
            } else {
                // Single element selection and download
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
            }
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

            // Check for keyboard shortcuts when highlighter is active
            if (this.isActive && !this.isDownloading) {
                // 'C' key to clear selection
                if (e.key === 'c' || e.key === 'C') {
                    SelectionManager.clearSelection();
                    UIManager.showNotification('Selection cleared');
                    e.preventDefault();
                    e.stopPropagation();
                }

                // 'D' key to download selected elements
                if (e.key === 'd' || e.key === 'D') {
                    if (SelectionManager.selectedElements.length > 0) {
                        this.downloadSelectedElements();
                    } else {
                        UIManager.showNotification('No elements selected for download');
                    }
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        },

        /**
         * Downloads all selected elements
         */
        downloadSelectedElements() {
            if (SelectionManager.selectedElements.length === 0) {
                UIManager.showNotification('No elements selected for download');
                return;
            }

            this.isDownloading = true;

            const defaultFileName = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            let userFileName = window.prompt('Enter file name for the download:', defaultFileName);

            if (userFileName === null) {
                this.isDownloading = false;
                return;
            }

            userFileName = userFileName.trim();
            if (userFileName === '') userFileName = defaultFileName;

            // Extract elements from selection
            const elements = SelectionManager.selectedElements.map(item => item.element);

            const downloadSuccess = Downloader.downloadMultipleElements(elements, userFileName);

            if (downloadSuccess) {
                UIManager.showNotification('Selected elements downloaded successfully');

                // Clear the selection and deactivate highlighter to clean up
                SelectionManager.clearSelection();
                this.deactivateHighlighter();
            }

            this.isDownloading = false;
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
        },

        /**
         * Downloads multiple elements as a single HTML file
         * @param {Array} elements - Array of elements to download
         * @param {string} fileName - The name of the file
         * @returns {boolean} - Whether the download was successful
         */
        downloadMultipleElements(elements, fileName) {
            try {
                // Create container for all elements
                const container = document.createElement('div');
                container.className = 'element-highlighter-container';

                // Process each element
                elements.forEach((element, index) => {
                    // Create a clone to avoid modifying the original
                    const clone = element.cloneNode(true);

                    // Process all relative links in the clone
                    ElementProcessor.processLinks(clone, window.location.href);

                    // Process images (including SVG handling)
                    const withImages = ElementProcessor.processImages(clone);

                    // Process styles
                    const { element: processed } = ElementProcessor.processStyles(withImages);

                    // Create a wrapper for this element
                    const wrapper = document.createElement('div');
                    wrapper.className = 'element-highlighter-item';
                    wrapper.style.margin = '20px 0';
                    wrapper.style.padding = '20px';
                    wrapper.style.border = '1px solid #ddd';
                    wrapper.style.borderRadius = '5px';

                    // Add element number header
                    const header = document.createElement('div');
                    header.className = 'element-highlighter-header';
                    header.style.marginBottom = '10px';
                    header.style.paddingBottom = '10px';
                    header.style.borderBottom = '1px solid #eee';
                    header.style.fontWeight = 'bold';
                    header.textContent = `Element ${index + 1}: ${element.tagName.toLowerCase()}`;

                    // If element has ID or class, add that info
                    if (element.id || element.className) {
                        const idClass = document.createElement('span');
                        idClass.style.fontWeight = 'normal';
                        idClass.style.fontSize = '0.9em';
                        idClass.style.color = '#666';
                        idClass.style.marginLeft = '5px';

                        let idClassText = '';
                        if (element.id) {
                            idClassText += `#${element.id}`;
                        }
                        if (element.className) {
                            const firstClass = element.className.split(' ')[0];
                            idClassText += idClassText ? ` .${firstClass}` : `.${firstClass}`;
                        }

                        idClass.textContent = idClassText;
                        header.appendChild(idClass);
                    }

                    wrapper.appendChild(header);
                    wrapper.appendChild(processed);
                    container.appendChild(wrapper);
                });

                // Get basic CSS
                const basicCSS = `
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .element-highlighter-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                    .element-highlighter-item { break-inside: avoid; page-break-inside: avoid; }
                    table { border-collapse: collapse; }
                    td, th { padding: 8px; }
                    img { max-width: 100%; height: auto; }
                    @media print {
                        .element-highlighter-header { background-color: #f5f5f5 !important; -webkit-print-color-adjust: exact; }
                        .element-highlighter-item { border: 1px solid #ccc !important; page-break-inside: avoid; }
                    }
                `;

                const content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${document.title} - Selected Elements</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        ${basicCSS}
    </style>
    <!--
    Source URL: ${window.location.href}
    Captured Elements: ${elements.length}
    Capture Date: ${new Date().toISOString()}
    Processing: Images, styles, and links converted to absolute URLs
    -->
</head>
<body>
    <div class="element-highlighter-container">
        <h1 style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #eee;">
            Selected Elements from ${document.title}
        </h1>
        <p style="color: #666; margin-bottom: 30px;">
            Source: <a href="${window.location.href}">${window.location.href}</a><br>
            Captured: ${new Date().toLocaleString()}<br>
            Elements: ${elements.length}
        </p>
        ${container.innerHTML}
    </div>
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

                UIManager.showNotification(`${elements.length} elements downloaded with preserved styles`);
                return true;
            } catch (error) {
                console.error('Download failed:', error);
                UIManager.showNotification('Failed to download elements');
                return false;
            }
        }
    };

    // Initialize the highlighter
    Highlighter.init();
})();