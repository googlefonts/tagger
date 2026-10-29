<script setup lang="ts">
import { Font, GF, VariableTagging } from '@/models';
import type { Location } from '@/models';
import { computed, ref, triggerRef } from 'vue';
import type { PropType } from 'vue';

// This is different to a VariableTagging, in that we're going to turn a bunch of these
// into a VariableTagging later using radial basis multiplication.
interface ScoreAtAxisValue { value: number; score: number; };
type VfTagScore = Record<string, ScoreAtAxisValue[]>;

const newTagScore = ref<number | null>(null);
const newVfTagScoreAxis = ref<string | null>(null);
const newVfTagScores = ref<VfTagScore>({});
// Scores the user has edited in the multi-axis grid, keyed by location JSON
const gridOverrides = ref<Record<string, number>>({});

const props = defineProps({
    font: {
        type: Font,
        required: true
    },
    gf: {
        type: GF,
        required: true
    },
    newTag: {
        type: String,
        required: true
    },
    scripts: {
        type: Array as PropType<string[]>,
        default: () => []
    }
});


function addAxis() {
    if (!props.font || !newVfTagScoreAxis.value) return;
    const axis = props.font.axes.find(a => a.tag === newVfTagScoreAxis.value);
    if (!axis) return;
    newVfTagScores.value[newVfTagScoreAxis.value] = [{
        value: axis.min,
        score: newTagScore.value || 0
    }, {
        value: axis.max,
        score: newTagScore.value || 100
    }];
    newVfTagScoreAxis.value = null;
    triggerRef(newVfTagScores); // Shouldn't be necessary. But it is.
    triggerRef(newTagScore);
}

function addMedialValue(axis: string) {
    if (!props.font || !newVfTagScores.value) return;
    let values = newVfTagScores.value[axis].map((v) => v.value);
    console.log(values);
    for (let left of values) {
        for (let right of values) {
            let medial = (left + right) / 2;
            if (!values.includes(medial)) {
                newVfTagScores.value[axis].push({ value: medial, score: 0 })
                triggerRef(newVfTagScores);
                return;
            }
        }
    }
}

function removeScore(scores: ScoreAtAxisValue[], idx: number) {
    scores.splice(idx, 1);
    triggerRef(newVfTagScores);
}


interface GridPoint { location: Location; key: string; defaultScore: number; }

// With more than one axis, a tagging needs a score at every combination of
// the per-axis values (e.g. "wdth,wght@75,100"), which is how families.csv
// stores them. Build that grid, in the font's axis order, and seed each point
// with the average of the per-axis scores.
const grid = computed<GridPoint[]>(() => {
    const chosen = Object.keys(newVfTagScores.value);
    if (!props.font || chosen.length < 2) return [];
    const axes = props.font.axes.map(a => a.tag).filter(tag => chosen.includes(tag));
    let points: { location: Location; scores: number[] }[] = [{ location: {}, scores: [] }];
    for (const axis of axes) {
        const next: typeof points = [];
        for (const point of points) {
            for (const entry of newVfTagScores.value[axis]) {
                next.push({
                    location: { ...point.location, [axis]: entry.value },
                    scores: [...point.scores, entry.score],
                });
            }
        }
        points = next;
    }
    return points.map(p => ({
        location: p.location,
        key: JSON.stringify(p.location),
        defaultScore: Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length),
    }));
});

function gridScore(point: GridPoint): number {
    return gridOverrides.value[point.key] ?? point.defaultScore;
}

function setGridScore(point: GridPoint, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    // Reassign so Vue 2 notices the new key
    gridOverrides.value = { ...gridOverrides.value, [point.key]: value };
}

function locationLabel(location: Location): string {
    return Object.entries(location).map(([axis, val]) => `${axis}=${val}`).join(', ');
}

function addVariableTag() {
    if (!props.font || !props.newTag || newVfTagScores.value === null) return;
    const tag = props.gf.tags[props.newTag];
    if (!tag) {
        console.error("Tag not found:", props.newTag);
        return;
    }
    let scores: { location: Location; score: number }[];
    if (Object.keys(newVfTagScores.value).length == 1) {
        // Single axis, easy case
        let axis = Object.keys(newVfTagScores.value)[0];
        let values = Object.values(newVfTagScores.value)[0];
        scores = values.map((s) => ({ location: { [axis]: s.value }, score: s.score }));
    } else {
        scores = grid.value.map((p) => ({ location: p.location, score: gridScore(p) }));
    }
    props.font.taggings.push(new VariableTagging(props.font, tag, scores, [...props.scripts]));
}

function notReady(): boolean {
    if (!props.font || !props.newTag) { return true }
    if (newVfTagScores.value === null) { return true }
    if (Object.keys(newVfTagScores.value).length < 1) { return true }
    // Each of the axes must have at least two value/score pairs
    for (const scores of Object.values(newVfTagScores.value)) {
        if (scores.length < 2) return true;
    }
    return false;
}
</script>
<template>
    <div>
        <div v-for="(scores, axis) of newVfTagScores" :key="axis" class="vf-tag-axis">
            <span>{{ axis }}:</span>
            <div v-for="(score, idx) in scores" :key="idx">
                {{ axis }}=<input type="number" v-model.number="score.value" placeholder="Value"
                    :min="font.axis(axis)?.min" :max="font.axis(axis)?.max" /> &nbsp;
                value=<input type="number" v-model.number="score.score" placeholder="Score (0-100)" />
                <button v-if="idx > 1" @click="removeScore(scores, idx)">Remove</button>
            </div>
            <button @click="addMedialValue(axis)">+</button>
        </div>
        <select v-model="newVfTagScoreAxis" class="inline-block">
            <option v-for="axis in props.font?.axes.filter(axis => !(axis.tag in newVfTagScores))" :key="axis.tag"
                :value="axis.tag">{{ axis.tag }}</option>
        </select>
        <button @click="addAxis()" :disabled="!newVfTagScoreAxis">Add axis</button>
        <div v-if="grid.length" class="vf-tag-grid">
            <div>Score at each location (seeded from the axis scores above, edit as needed):</div>
            <div v-for="point in grid" :key="point.key">
                {{ locationLabel(point.location) }}:
                <input type="number" :value="gridScore(point)" @input="setGridScore(point, $event)" min="0"
                    max="100" style="width: 60px;" />
            </div>
        </div>
        <!-- at least two value/score pairs-->
        <button @click="addVariableTag()" :disabled="notReady()">Add Variable
            Tag</button>
    </div>
</template>
