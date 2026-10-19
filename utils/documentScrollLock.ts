"use client";

const locks = new Set<symbol>();
let restoreScroll: (() => void) | undefined;

function preserveStyles(element: HTMLElement, properties: string[]) {
  const saved = properties.map((property) => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
  return () => saved.forEach(([property, value, priority]) => {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  });
}

/** A nested modal cannot unlock the document while another modal is open. */
export function lockDocumentScroll() {
  const token = Symbol("modal-scroll-lock");
  if (locks.size === 0) {
    const root = document.documentElement;
    const body = document.body;
    const x = window.scrollX;
    const y = window.scrollY;
    const clientWidth = root.clientWidth;
    const paddingRight = parseFloat(getComputedStyle(body).paddingRight) || 0;
    const restoreRoot = preserveStyles(root, ["overflow", "overflow-x", "overflow-y", "overscroll-behavior", "overscroll-behavior-x", "overscroll-behavior-y", "scroll-behavior"]);
    const restoreBody = preserveStyles(body, ["overflow", "overflow-x", "overflow-y", "overscroll-behavior", "overscroll-behavior-x", "overscroll-behavior-y", "position", "top", "left", "width", "padding-right"]);
    root.classList.add("app-modal-open");
    window.dispatchEvent(new CustomEvent("ayursarga:scroll-lock", { detail: true }));
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    root.style.scrollBehavior = "auto";
    // Fixed body also prevents background touch scrolling on iOS Safari.
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = `-${x}px`;
    body.style.width = "100%";
    const lostGutter = root.clientWidth - clientWidth;
    if (lostGutter > 0) body.style.paddingRight = `${paddingRight + lostGutter}px`;
    restoreScroll = () => {
      restoreBody();
      root.classList.remove("app-modal-open");
      // Restore immediately, even if the original document used smooth scrolling.
      window.scrollTo({ left: x, top: y, behavior: "instant" });
      restoreRoot();
      window.dispatchEvent(new CustomEvent("ayursarga:scroll-lock", { detail: false }));
    };
  }
  locks.add(token);
  return () => {
    if (!locks.delete(token) || locks.size > 0) return;
    restoreScroll?.();
    restoreScroll = undefined;
  };
}
