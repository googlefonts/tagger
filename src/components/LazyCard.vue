<script setup lang="ts">
// Renders its slot only while it is on or near the screen. Off screen it is an
// empty box of the same height, so a list of two thousand cards costs the
// browser only the twenty or so it can show: their fonts, their editable
// previews and their animations. The data behind a card lives in the model, so
// a card that goes off screen and comes back shows the same scores.
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { observeVisibility } from '@/visibility';

const props = defineProps({
    // Height of the box before the card has been rendered once
    estimatedHeight: {
        type: Number,
        default: 130,
    },
});

// How far outside the viewport a card is still rendered, so it is ready by
// the time it scrolls in.
const MARGIN = '600px 0px';

const root = ref<HTMLElement | null>(null);
const shown = ref(false);
const measuredHeight = ref<number | null>(null);
let stop: (() => void) | null = null;

function setVisible(visible: boolean) {
    if (visible) {
        shown.value = true;
        return;
    }
    if (!shown.value || !root.value) return;
    // Keep a card the user is typing in, or the keystrokes would be lost
    if (root.value.contains(document.activeElement)) return;
    measuredHeight.value = root.value.offsetHeight;
    shown.value = false;
}

onMounted(() => {
    if (root.value) stop = observeVisibility(root.value, setVisible, MARGIN);
});
onBeforeUnmount(() => {
    if (stop) stop();
});
</script>

<template>
    <div ref="root" class="lazy-card"
        :style="shown ? undefined : { minHeight: (measuredHeight ?? props.estimatedHeight) + 'px' }">
        <slot v-if="shown"></slot>
    </div>
</template>
