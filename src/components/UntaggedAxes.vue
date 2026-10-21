<script setup lang="ts">
import { EventBus } from '@/eventbus';
import { GF } from '@/models';
import type { Axis, Font } from '@/models';
import { computed, defineProps, watch } from 'vue';

const props = defineProps({
    gf: {
        type: GF,
        required: true
    }
});

interface FamilyAxes {
    font: Font;
    untaggedAxes: Axis[]; // Axes no variable tag varies along
    variableTagCount: number;
}

// Variable fonts with at least one axis that no variable tag uses. Static
// tags give one score for the whole designspace, so they say nothing about
// how the font changes along an axis.
const families = computed<FamilyAxes[]>(() => {
    const result: FamilyAxes[] = [];
    for (const font of props.gf.families) {
        if (!font.isVF) continue;
        const used = new Set<string>();
        let variableTagCount = 0;
        for (const tagging of font.taggings) {
            if (!('scores' in tagging)) continue;
            variableTagCount++;
            for (const s of tagging.scores) {
                Object.keys(s.location).forEach(axis => used.add(axis));
            }
        }
        const untaggedAxes = font.axes.filter(axis => !used.has(axis.tag));
        if (untaggedAxes.length) {
            result.push({ font, untaggedAxes, variableTagCount });
        }
    }
    return result.sort((a, b) => a.font.name.localeCompare(b.font.name));
});

const variableFontCount = computed(() => props.gf.families.filter(f => f.isVF).length);
const axisCount = computed(() => families.value.reduce((n, f) => n + f.untaggedAxes.length, 0));

watch(families, (list) => {
    list.forEach(f => EventBus.$emit('ensure-loaded', f.font.name));
}, { immediate: true });

function addFontPanel(font: string) {
    EventBus.$emit('add-font-panel', font);
}
</script>
<template>
    <div>
        <h3>Untagged axes</h3>
        <p v-if="families.length === 0">Every axis of every variable font has at least one variable tag.</p>
        <p v-else>
            {{ axisCount }} axes in {{ families.length }} of {{ variableFontCount }} variable fonts have no variable tag.
        </p>
        <ul class="untagged-list">
            <li v-for="entry in families" :key="entry.font.name">
                <span class="untagged-name" :style="{ fontFamily: entry.font.name }">{{ entry.font.name }}</span>
                <span class="untagged-axes">
                    {{ entry.untaggedAxes.map(a => `${a.tag} ${a.min}–${a.max}`).join(', ') }}
                    <span v-if="entry.variableTagCount === 0">(no variable tags)</span>
                </span>
                <button @click="addFontPanel(entry.font.name)">Tag it</button>
            </li>
        </ul>
    </div>
</template>
