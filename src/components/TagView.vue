<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, ref, computed } from 'vue';
import type { PropType } from 'vue';
import type { Tagging, Location } from '../models';
import { EventBus } from '@/eventbus';

const props = defineProps({
    tagging: Object as PropType<Tagging>,
    location: Object as PropType<Location>,
});

onBeforeMount(() => { EventBus.$emit('ensure-loaded', props.tagging?.font.name); });
const removeTagging = () => { props.tagging?.font.removeTagging(props.tagging) }

const currentLocationIndex = ref(0);
let animationInterval: ReturnType<typeof setInterval> | null = null;

// Build cross-product of per-axis values for animation.
// E.g. scores [{location:{wdth:75}}, {location:{wdth:100}}, {location:{wght:400}}, {location:{wght:900}}]
// becomes [{wdth:75,wght:400}, {wdth:75,wght:900}, {wdth:100,wght:400}, {wdth:100,wght:900}]
const animationFrames = computed(() => {
    if (!props.tagging || !('scores' in props.tagging) || props.tagging.scores.length === 0) {
        return [];
    }
    // Collect unique values per axis
    const axisValues: Record<string, number[]> = {};
    for (const entry of props.tagging.scores) {
        for (const [axis, val] of Object.entries(entry.location)) {
            if (!axisValues[axis]) axisValues[axis] = [];
            if (!axisValues[axis].includes(val)) axisValues[axis].push(val);
        }
    }
    // Sort each axis's values
    for (const axis in axisValues) {
        axisValues[axis].sort((a, b) => a - b);
    }
    // Generate cross-product (nested loop order: outer axis changes slowest)
    const axes = Object.keys(axisValues);
    let frames: Location[] = [{}];
    for (const axis of axes) {
        const newFrames: Location[] = [];
        for (const frame of frames) {
            for (const val of axisValues[axis]) {
                newFrames.push({ ...frame, [axis]: val });
            }
        }
        frames = newFrames;
    }
    return frames;
});

const animatedStyle = computed(() => {
    if (!props.tagging) return '';
    if (animationFrames.value.length === 0) {
        return props.tagging.font.cssStyle(32);
    }
    const location = animationFrames.value[currentLocationIndex.value % animationFrames.value.length];
    let style = `font-family: '${props.tagging.font.name}'; font-size: 32pt; transition: font-variation-settings 1s ease; font-variation-settings:`;
    style += Object.entries(location).map(([tag, val]) => ` '${tag}' ${val}`).join(',');
    style += ';';
    return style;
});

onBeforeMount(() => {
    if (animationFrames.value.length > 1) {
        animationInterval = setInterval(() => {
            currentLocationIndex.value++;
        }, 2000);
    }
});

onBeforeUnmount(() => {
    if (animationInterval) clearInterval(animationInterval);
});

</script>


<template>
    <div class="tag-view">
        <div class="tag-title">
            <span class="tag-name">{{ props.tagging?.tag.name }}
                <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -1000 960 960" fill="#000000">
                    <path d=" M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5
                    11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83
                    31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5
                    156T763-197q-54 54-127 85.5T480-80Z" />
                </svg>
            </span>
            <span class="tag-family">{{ props.tagging?.font.name }}</span>
            <span class="tag-score" v-if="props.tagging && !('scores' in props.tagging)">
                Score: <input type="number" v-model.lazy="props.tagging.score" style="width: 60px;" />
            </span>
            <span class="tag-score variable-tag" v-if="props.tagging && 'scores' in props.tagging">
                Variable tag
                <div v-for="(entry, idx) in props.tagging.scores" :key="idx">
                    <span v-for="(val, axis) in entry.location" :key="axis">
                        {{ axis }}=<input type="number" v-model.number="entry.location[axis]" style="width: 70px;"
                            :min="props.tagging.font.axis(axis)?.min"
                            :max="props.tagging.font.axis(axis)?.max" />
                    </span>
                    score=<input type="number" v-model.number="entry.score" style="width: 60px;" />
                </div>
            </span>
            <button @click="removeTagging" class="remove-tag-btn">Remove</button>
        </div>
        <div class="text-editor" contenteditable="true" :style="animatedStyle">
            Hello world
        </div>
    </div>
</template>