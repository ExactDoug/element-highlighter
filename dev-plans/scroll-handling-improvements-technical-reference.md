# Research on scroll-handling improvements

Does the perplexity web interface do lazy loading? here is the source code in my browser:

I have the following userscript that is supposed to cause the selected selector areas when using shift-click to then display a rectangle around those selectors, which would then give visual indication for the sections that have been selected to be included in our html export, and the code in the userscript is supposed to cause these selection rectangles to scroll with the content of the page as the user scrolls through the page, but they are in fact not moving and I am wondering if this could have anything to do with the way the perplexity web interface may lazy load, or use asyncio or something else....?

Here is the code:
Show less
Does the perplexity web interface do lazy loading? here is the source code in my browser: I have the following userscript that is supposed to cause the selected selector areas when using shift-click to then display a rectangle around those selectors, which would then give visual indication for the sections that have been selected to be included in our html export, and the code in the userscript is supposed to cause these selection rectangles to scroll with the content of the page as the user scrolls through the page, but they are in fact not moving and I am wondering if this could have anything to do with the way the perplexity web interface may lazy load, or use asyncio or something else....? Here is the code:

Reasoning

Sources
61
Based on the HTML source code provided, the Perplexity web interface does indeed use several modern web techniques that could affect your userscript's scrolling behavior:

Modern Web Techniques in Perplexity
Asynchronous Script Loading: The interface loads numerous JavaScript files with the async attribute, as seen in the multiple script tags with URLs like <https://pplx-next-static-public.perplexity.ai/_next/static/chunks/...>

Component-Based Architecture: The page structure suggests a React-based application with dynamically rendered components.

Custom Scrollable Containers: The code contains elements with classes like scrollable-container scrollbar-thin scrollbar-track-transparent scrollbar-thumb-idle dark:scrollbar-thumb-idleDark flex-1 basis-0 overflow-auto [scrollbar-gutter:stable].

Virtualization: There are indications the interface might be virtualizing content (only rendering visible elements), particularly for long content sections.

Why Your Selection Rectangles Aren't Scrolling
Your userscript issue is likely occurring because:

Nested Scrollable Containers: Perplexity uses nested scrollable containers rather than just the main document scroll. The scrollable elements are defined with classes like overflow-auto.

Transform-Based Animations: The interface uses CSS transforms extensively (transform: none; transform-origin: 50% 50% 0px;) for positioning elements, which can affect absolute positioning calculations.

Dynamic Content Rendering: Content is likely being loaded and rendered dynamically as the user scrolls, which could invalidate DOM references your script relies on.

Potential Solutions
To fix your userscript:

Attach your selection rectangles to the same scrollable container that holds the content, not to the document body.

Use a mutation observer to detect when new content is added to the DOM.

Consider using position:fixed elements that you manually reposition based on scroll events of the specific scrollable container (not just the window scroll).

Identify the main scrollable container with a selector like .scrollable-container and listen for scroll events on that element instead of the window.

The code structure suggests Perplexity is built with Next.js and employs sophisticated scrolling and rendering techniques that require special handling in userscripts that interact with page elements during scrolling.

What if I want it to also be somewhat agnostic in that it would employ this type of functionality not only specific to perplexity, but also any websites that use these types of techniques?

And I don't want to overcomplicate it and give myself a debugging nightmare either.
What if I want it to also be somewhat agnostic in that it would employ this type of functionality not only specific to perplexity, but also any websites that use these types of techniques? And I don't want to overcomplicate it and give myself a debugging nightmare either.

Reasoning

Sources
64
To make your selection rectangle userscript work across multiple websites that use modern web techniques like Perplexity, you'll need a more flexible approach that can adapt to different implementations of lazy loading, virtualized scrolling, and dynamic content rendering.

A More Universal Approach
Here are strategies to make your script more framework-agnostic while keeping it maintainable:

Use Mutation Observers Instead of Fixed Selectors

Implement a MutationObserver to detect when the DOM changes due to lazy loading or virtual scrolling

This ensures your selection rectangles remain valid even when content is dynamically updated

javascript
const observer = new MutationObserver(mutations => {
  // Update your selection rectangles when DOM changes
  updateSelectionRectangles();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
Detect Scroll Containers Dynamically

Instead of hardcoding scrollable element selectors, detect them by checking for overflow properties:

javascript
function findScrollContainers() {
  return Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return (style.overflow === 'auto' || style.overflow === 'scroll' ||
            style.overflowY === 'auto' || style.overflowY === 'scroll');
  });
}
Attach Scroll Listeners to All Potential Containers

Add scroll event listeners to both window and all detected scroll containers:

javascript
const scrollContainers = findScrollContainers();
scrollContainers.forEach(container => {
  container.addEventListener('scroll', () => updateSelectionRectangles());
});
window.addEventListener('scroll', () => updateSelectionRectangles());
Use Position Fixed with Transform for Selections

For selection rectangles, consider using fixed positioning combined with transforms:

javascript
function updateSelectionRectangle(rect, targetElement) {
  const boundingRect = targetElement.getBoundingClientRect();
  rect.style.position = 'fixed';
  rect.style.top = `${boundingRect.top}px`;
  rect.style.left = `${boundingRect.left}px`;
  rect.style.width = `${boundingRect.width}px`;
  rect.style.height = `${boundingRect.height}px`;
}
Implement Throttling for Performance

Throttle scroll event handling to prevent performance issues:

javascript
function throttle(func, limit) {
  let inThrottle;
  return function() {
    if (!inThrottle) {
      func.apply(this, arguments);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

const throttledUpdate = throttle(updateSelectionRectangles, 50);
Handling Shift-Click Events
To make your shift-click selection mechanism work universally:

javascript
document.addEventListener('click', event => {
  if (event.shiftKey) {
    event.preventDefault();
    const targetElement = event.target;

    // Create or update selection rectangle
    const rect = createSelectionRectangle(targetElement);
    
    // Store reference to selected element
    selectedElements.push({
      element: targetElement,
      rectangle: rect
    });
  }
});
This approach should work across different websites regardless of their specific implementation details, as it adapts to the page structure rather than relying on hardcoded selectors or assumptions about the DOM structure.
