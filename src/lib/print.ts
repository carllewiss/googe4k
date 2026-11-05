/**
 * Isolated document printing.
 * Adds the `printing-invoice` body class so global print CSS hides app chrome,
 * scrollbars and dialog frames, then restores the UI afterwards.
 */
export function printDocument(delay = 120) {
  setTimeout(() => {
    document.body.classList.add("printing-invoice");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-invoice"), 300);
  }, delay);
}
