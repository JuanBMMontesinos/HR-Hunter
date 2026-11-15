export const ALLOWED_HTML_ELEMENTS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'span',
] as const;

export const ALLOWED_HTML_ATTRIBUTES = ['href', 'target', 'rel', 'class'] as const;

type DOMPurifyLike = {
  sanitize: (dirty: string, cfg?: Record<string, unknown>) => string;
};

let domPurifyPromise: Promise<DOMPurifyLike> | null = null;

async function loadDOMPurify(): Promise<DOMPurifyLike> {
  if (!domPurifyPromise) {
    domPurifyPromise = import('dompurify').then((mod) => {
      const candidate = (mod.default ?? mod) as unknown as DOMPurifyLike;
      return candidate;
    });
  }
  return domPurifyPromise;
}

export function isNativeSanitizerSupported(): boolean {
  return (
    typeof Element !== 'undefined' &&
    typeof Element.prototype === 'object' &&
    'setHTML' in Element.prototype
  );
}

/**
 * Renders untrusted HTML safely into a DOM Element using the native Sanitizer API
 * when available, falling back strictly to lazy-loaded DOMPurify with matched rules.
 */
export async function safeSetElementHtml(element: Element, html: string): Promise<void> {
  const rawHtml = typeof html === 'string' ? html : '';

  if (isNativeSanitizerSupported()) {
    const elWithSetHtml = element as Element & {
      setHTML: (input: string, options?: { sanitizer?: unknown }) => void;
    };
    elWithSetHtml.setHTML(rawHtml, {
      sanitizer: {
        elements: [...ALLOWED_HTML_ELEMENTS],
        attributes: [...ALLOWED_HTML_ATTRIBUTES],
      },
    });
    return;
  }

  const DOMPurify = await loadDOMPurify();
  element.innerHTML = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [...ALLOWED_HTML_ELEMENTS, '#text'],
    ALLOWED_ATTR: [...ALLOWED_HTML_ATTRIBUTES],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: false,
  });
}

/**
 * Produces a sanitized HTML string (for controlled submission to API) without XSS vectors.
 */
export async function sanitizeHtmlString(html: string): Promise<string> {
  const rawHtml = typeof html === 'string' ? html : '';
  const DOMPurify = await loadDOMPurify();
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [...ALLOWED_HTML_ELEMENTS, '#text'],
    ALLOWED_ATTR: [...ALLOWED_HTML_ATTRIBUTES],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: false,
  });
}
