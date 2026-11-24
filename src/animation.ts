// One clock for every animated preview. Each card used to run its own
// interval; hundreds of cards meant hundreds of timers firing out of step, so
// the page never had an idle frame. Now cards subscribe to one tick and the
// interval runs only while someone is listening.
type Listener = () => void;

export const ANIMATION_STEP_MS = 2000;

const listeners = new Set<Listener>();
let interval: ReturnType<typeof setInterval> | null = null;

function tick() {
  for (const listener of listeners) listener();
}

// Call `listener` on every animation step. Returns a function that
// unsubscribes.
export function onAnimationTick(listener: Listener): () => void {
  listeners.add(listener);
  if (!interval) interval = setInterval(tick, ANIMATION_STEP_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}
