<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, onMounted, ref, computed, watch } from 'vue';
import type { PropType } from 'vue';
import type { Tagging, Location } from '../models';
import { StaticTagging, VariableTagging, variateTagging, staticizeTagging, staticScoreFor } from '../models';
import { EventBus } from '@/eventbus';
import { SCRIPT_TAGGING } from '@/config';
import { onAnimationTick } from '@/animation';
import { observeVisibility } from '@/visibility';

const props = defineProps({
    tagging: Object as PropType<Tagging>,
    location: Object as PropType<Location>,
    vfDisplayMode: {
        type: String as PropType<'animated' | 'list'>,
        default: 'animated',
    },
    // Text shown in the previews; the category view sets it for every tag at once
    sampleText: {
        type: String,
        default: '',
    },
});

const previewText = computed(() => props.sampleText.trim() || 'Hello world');

onBeforeMount(() => { EventBus.$emit('ensure-loaded', props.tagging?.font.name); });
const removeTagging = () => { props.tagging?.font.removeTagging(props.tagging) }

// Static tag of a family with grid axes: can become a variable tag
const canVariate = computed(() =>
    props.tagging instanceof StaticTagging && props.tagging.score !== null && props.tagging.font.gridAxes().length > 0);
const variate = () => { if (props.tagging instanceof StaticTagging) variateTagging(props.tagging); };
// The score "To static" gives: the one it was variated from, else the highest
const staticTarget = computed(() =>
    props.tagging instanceof VariableTagging ? staticScoreFor(props.tagging) : null);
const toStatic = () => { if (props.tagging instanceof VariableTagging) staticizeTagging(props.tagging); };
// On the tagging itself, so every panel that shows it turns salmon
const markTouched = () => { if (props.tagging) props.tagging.touched = true; }
const inputValue = (e: Event) => Number((e.target as HTMLInputElement).value);

const variableScores = computed(() => {
    return props.tagging && 'scores' in props.tagging ? props.tagging.scores : [];
});

// A multi-axis variable tagging is a grid: one row for every combination
// of the values on each axis. Rows are added and removed a slice at a time
// (one axis value, with a row for every combination of the other axes), so
// the grid stays complete and interpolation between rows stays defined.
const axisNames = computed(() => {
    const scores = variableScores.value;
    return scores.length > 0 ? Object.keys(scores[0].location) : [];
});

const axisValues = computed<Record<string, number[]>>(() => {
    const values: Record<string, number[]> = {};
    for (const axis of axisNames.value) values[axis] = [];
    for (const entry of variableScores.value) {
        for (const axis of axisNames.value) {
            const val = entry.location[axis];
            if (val !== undefined && !values[axis].includes(val)) values[axis].push(val);
        }
    }
    for (const axis of axisNames.value) values[axis].sort((a, b) => a - b);
    return values;
});

const expectedRows = computed(() => {
    return axisNames.value.reduce((n, axis) => n * axisValues.value[axis].length, 1);
});

const isCompleteGrid = computed(() => {
    const scores = variableScores.value;
    if (scores.length === 0) return true;
    const keys = new Set(scores.map((entry) => locationKey(entry.location)));
    return keys.size === scores.length && keys.size === expectedRows.value;
});

function locationKey(location: Location): string {
    return axisNames.value.map((axis) => `${axis}=${location[axis]}`).join(',');
}

// Keep rows in grid order: first axis slowest, values ascending.
function sortScores() {
    variableScores.value.sort((a, b) => {
        for (const axis of axisNames.value) {
            const diff = a.location[axis] - b.location[axis];
            if (diff !== 0) return diff;
        }
        return 0;
    });
}

// Score at `value` on `axis`, read off the rows of one slice by linear
// interpolation between the two nearest values, or the nearest row's score
// outside the range the rows cover.
function interpolate(rows: { location: Location; score: number }[], axis: string, value: number): number {
    const sorted = [...rows].sort((a, b) => a.location[axis] - b.location[axis]);
    if (sorted.length === 0) return 0;
    if (value <= sorted[0].location[axis]) return sorted[0].score;
    const last = sorted[sorted.length - 1];
    if (value >= last.location[axis]) return last.score;
    for (let i = 1; i < sorted.length; i++) {
        const lo = sorted[i - 1], hi = sorted[i];
        if (value <= hi.location[axis]) {
            const t = (value - lo.location[axis]) / (hi.location[axis] - lo.location[axis]);
            return Math.round(lo.score + t * (hi.score - lo.score));
        }
    }
    return last.score;
}

const newValue = ref<Record<string, number | null>>({});

function addAxisValue(axis: string) {
    const value = newValue.value[axis];
    if (value === null || value === undefined || isNaN(value)) return;
    if (axisValues.value[axis].includes(value)) return;
    const scores = variableScores.value;
    const others = axisNames.value.filter((a) => a !== axis);
    // One new row per combination of the other axes' values that exists in the rows
    const combos = new Map<string, Location>();
    for (const entry of scores) {
        const combo: Location = {};
        for (const a of others) combo[a] = entry.location[a];
        combos.set(JSON.stringify(combo), combo);
    }
    for (const combo of combos.values()) {
        const slice = scores.filter((entry) => others.every((a) => entry.location[a] === combo[a]));
        const location: Location = {};
        for (const a of axisNames.value) location[a] = a === axis ? value : combo[a];
        scores.push({ location, score: interpolate(slice, axis, value) });
    }
    sortScores();
    newValue.value = { ...newValue.value, [axis]: null };
    markTouched();
}

function removeAxisValue(axis: string, value: number) {
    if (axisValues.value[axis].length <= 1) return;
    const scores = variableScores.value;
    for (let i = scores.length - 1; i >= 0; i--) {
        if (scores[i].location[axis] === value) scores.splice(i, 1);
    }
    markTouched();
}

function renameAxisValue(axis: string, oldValue: number, e: Event) {
    const input = e.target as HTMLInputElement;
    const value = Number(input.value);
    if (input.value === '' || isNaN(value) || value === oldValue) { input.value = String(oldValue); return; }
    if (axisValues.value[axis].includes(value)) { input.value = String(oldValue); return; }
    for (const entry of variableScores.value) {
        if (entry.location[axis] === oldValue) entry.location[axis] = value;
    }
    sortScores();
    markTouched();
}

// Script tagging: copy this tagging, scores and all, for another set of
// scripts on the same font. The copy is a separate tagging the user can
// then score differently.
const duplicateScripts = ref<string[]>([]);
const scriptOptions = computed(() => props.tagging?.font.subsets ?? []);
const scriptsLabel = computed(() => {
    const scripts = props.tagging?.scripts ?? [];
    return scripts.length > 0 ? scripts.join(', ') : 'All scripts';
});
const duplicateExists = computed(() => {
    if (!props.tagging || duplicateScripts.value.length === 0) return false;
    return props.tagging.font.hasTaggingForScripts(props.tagging.tag.name, duplicateScripts.value);
});

function duplicateForScripts() {
    const tagging = props.tagging;
    if (!tagging || duplicateScripts.value.length === 0 || duplicateExists.value) return;
    const scripts = [...duplicateScripts.value].sort();
    let copy: Tagging;
    if ('scores' in tagging) {
        const scores = tagging.scores.map((entry) => ({ location: { ...entry.location }, score: entry.score }));
        copy = new VariableTagging(tagging.font, tagging.tag, scores, scripts);
    } else {
        copy = new StaticTagging(tagging.font, tagging.tag, tagging.score, scripts);
    }
    tagging.font.addTagging(copy);
    duplicateScripts.value = [];
}

const currentLocationIndex = ref(0);
const editing = ref(false);
let stopAnimation: (() => void) | null = null;
// Whether the card is on screen; an off-screen preview is not animated
const onScreen = ref(true);
const root = ref<HTMLElement | null>(null);
let stopWatchingScreen: (() => void) | null = null;

// Build cross-product of per-axis values for animation.
// E.g. scores [{location:{wdth:75}}, {location:{wdth:100}}, {location:{wght:400}}, {location:{wght:900}}]
// becomes [{wdth:75,wght:400}, {wdth:75,wght:900}, {wdth:100,wght:400}, {wdth:100,wght:900}]
const animationFrames = computed(() => {
    if (!props.tagging) return [];
    if (!('scores' in props.tagging)) {
        // A static tag of a variable family: cycle through the corners of the
        // family's grid axes, so the tagger sees the whole range
        return props.vfDisplayMode === 'animated' ? props.tagging.font.cornerLocations() : [];
    }
    if (props.tagging.scores.length === 0) return [];
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
    let style = `font-family: '${props.tagging.font.name}'; font-size: 32pt; transition: font-variation-settings 0.5s ease; font-variation-settings:`;
    style += Object.entries(location).map(([tag, val]) => ` '${tag}' ${val}`).join(',');
    style += ';';
    return style;
});

function styleForLocation(location: Location) {
    if (!props.tagging) return '';
    let style = `font-family: '${props.tagging.font.name}'; font-size: 32pt; font-variation-settings:`;
    style += Object.entries(location).map(([tag, val]) => ` '${tag}' ${val}`).join(',');
    style += ';';
    return style;
}

// How to lay out a variable tagging: one preview per location in list mode
// (its score row goes under it), or a single animated preview with all the
// score rows under it.
interface PreviewGroup { key: string; style: string; indices: number[]; }
const previewGroups = computed<PreviewGroup[]>(() => {
    if (!props.tagging || !('scores' in props.tagging)) return [];
    const scores = props.tagging.scores;
    if (props.vfDisplayMode === 'animated') {
        return [{ key: 'animated', style: animatedStyle.value, indices: scores.map((_, idx) => idx) }];
    }
    return scores.map((entry, idx) => ({
        key: String(idx),
        style: styleForLocation(entry.location),
        indices: [idx],
    }));
});

// Animate only while there is more than one frame and the card is on
// screen. The tagging can change under this card (Variate, To static), so
// this is a watch, not a one-off at mount. The ticks come from one shared
// clock, see animation.ts.
function syncAnimation() {
    const wanted = animationFrames.value.length > 1 && onScreen.value;
    if (wanted && !stopAnimation) {
        stopAnimation = onAnimationTick(() => {
            if (!editing.value) currentLocationIndex.value++;
        });
    } else if (!wanted && stopAnimation) {
        stopAnimation();
        stopAnimation = null;
    }
}
watch(() => [animationFrames.value.length, onScreen.value], syncAnimation, { immediate: true });

onMounted(() => {
    if (root.value) stopWatchingScreen = observeVisibility(root.value, (visible) => { onScreen.value = visible; });
});

onBeforeUnmount(() => {
    if (stopAnimation) stopAnimation();
    if (stopWatchingScreen) stopWatchingScreen();
});

</script>


<template>
    <div ref="root" class="tag-view" :class="{ touched: props.tagging?.touched, placeholder: props.tagging?.placeholder }">
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
                Score: <input type="number" v-model.lazy="props.tagging.score" style="width: 60px;" @change="markTouched" />
            </span>
            <span class="tag-score variable-tag" v-if="props.tagging && 'scores' in props.tagging">
                Variable tag
            </span>
            <button v-if="canVariate" @click="variate" class="convert-btn"
                title="Make a variable tag with this score at every corner">Variate</button>
            <button v-if="staticTarget !== null" @click="toStatic" class="convert-btn"
                :title="props.tagging && 'staticScore' in props.tagging && props.tagging.staticScore !== null
                    ? 'Back to the static score it had' : 'A static tag with the highest score'">
                To static ({{ staticTarget }})</button>
            <button @click="removeTagging" class="remove-tag-btn">Remove</button>
        </div>
        <div v-if="SCRIPT_TAGGING && props.tagging" class="tag-scripts">
            <span class="tag-scripts-label">Scripts: {{ scriptsLabel }}</span>
            <span class="tag-duplicate">
                Duplicate for
                <v-select multiple v-model="duplicateScripts" :options="scriptOptions" placeholder="scripts"
                    class="inline-block script-select"></v-select>
                <button @click="duplicateForScripts" :disabled="duplicateScripts.length === 0 || duplicateExists"
                    :title="duplicateExists ? 'This font already has this tag for those scripts' : ''"
                    class="duplicate-btn">Duplicate</button>
            </span>
        </div>
        <div v-if="!props.tagging || !('scores' in props.tagging)" class="text-editor" contenteditable="true" :style="animatedStyle">
            {{ previewText }}
        </div>
        <div v-else class="location-list">
            <div class="axis-values">
                <div v-for="axis in axisNames" :key="axis" class="axis-values-row">
                    <span class="axis-values-label">{{ axis }}</span>
                    <span v-for="val in axisValues[axis]" :key="val" class="axis-value">
                        <input type="number" :value="val" style="width: 70px;"
                            :min="props.tagging.font.axis(axis)?.min"
                            :max="props.tagging.font.axis(axis)?.max"
                            @focus="editing = true"
                            @change="renameAxisValue(axis, val, $event)"
                            @blur="editing = false" />
                        <button @click="removeAxisValue(axis, val)" :disabled="axisValues[axis].length <= 1"
                            class="remove-value-btn" title="Remove this value and its rows">×</button>
                    </span>
                    <span class="axis-value-add">
                        <input type="number" v-model.number="newValue[axis]" placeholder="new" style="width: 70px;"
                            :min="props.tagging.font.axis(axis)?.min"
                            :max="props.tagging.font.axis(axis)?.max"
                            @focus="editing = true"
                            @keyup.enter="addAxisValue(axis)"
                            @blur="editing = false" />
                        <button @click="addAxisValue(axis)" class="add-value-btn">Add</button>
                    </span>
                </div>
                <div v-if="!isCompleteGrid" class="grid-warning">
                    Rows do not form a complete grid: {{ variableScores.length }} rows for
                    {{ expectedRows }} combinations of axis values.
                </div>
            </div>
            <div v-for="group in previewGroups" :key="group.key" class="location-entry">
                <div class="text-editor" contenteditable="true" :style="group.style">
                    {{ previewText }}
                </div>
                <div v-for="idx in group.indices" :key="idx" class="location-row">
                    <span v-for="(val, axis) in variableScores[idx].location" :key="axis">
                        {{ axis }}={{ val }}
                    </span>
                    score=<input type="number" :value="variableScores[idx].score" style="width: 60px;"
                        @focus="editing = true"
                        @change="variableScores[idx].score = inputValue($event); markTouched()"
                        @blur="editing = false" />
                </div>
            </div>
        </div>
    </div>
</template>