/** Dispatched after cart mutations so the header badge can refresh without coupling components. */
export function notifyCartChanged() {
  window.dispatchEvent(new Event('vivan-cart'));
}
