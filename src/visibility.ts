// Shared IntersectionObservers. Every card on the page asks whether it is on
// screen, and one observer per margin answers all of them, which is far
// cheaper than an observer per card.
type Callback = (visible: boolean) => void;

const observers = new Map<string, IntersectionObserver>();
const callbacks = new WeakMap<Element, Callback>();

function observerFor(rootMargin: string): IntersectionObserver {
  let observer = observers.get(rootMargin);
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) callbacks.get(entry.target)?.(entry.isIntersecting);
      },
      { rootMargin }
    );
    observers.set(rootMargin, observer);
  }
  return observer;
}

// Call `callback` whenever `el` enters or leaves the viewport grown by
// `rootMargin`. Returns a function that stops watching.
export function observeVisibility(el: Element, callback: Callback, rootMargin = "0px"): () => void {
  if (typeof IntersectionObserver === "undefined") {
    callback(true);
    return () => {};
  }
  const observer = observerFor(rootMargin);
  callbacks.set(el, callback);
  observer.observe(el);
  return () => {
    observer.unobserve(el);
    callbacks.delete(el);
  };
}
