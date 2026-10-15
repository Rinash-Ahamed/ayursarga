export function focusFirstInvalidField(form: HTMLFormElement) {
  window.requestAnimationFrame(() => {
    const field = form.querySelector<HTMLElement>(
      '[aria-invalid="true"]:not([disabled]), input:invalid:not([disabled]), select:invalid:not([disabled]), textarea:invalid:not([disabled])',
    );
    if (!field) return;
    const container = field.closest<HTMLElement>("label, fieldset, .portal-form-field") ?? field;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
    field.focus({ preventScroll: true });
    container.classList.remove("portal-validation-focus");
    void container.offsetWidth;
    container.classList.add("portal-validation-focus");
    window.setTimeout(() => container.classList.remove("portal-validation-focus"), 2_400);
  });
}
