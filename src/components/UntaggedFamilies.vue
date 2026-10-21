<script setup lang="ts">
import { EventBus } from '@/eventbus';
import { GF } from '@/models';
import { computed, defineProps, watch } from 'vue';

const props = defineProps({
    gf: {
        type: GF,
        required: true
    }
});

// Families with no taggings at all. Recomputed as taggings are added or
// removed elsewhere in the app, or when a different commit is loaded.
const untagged = computed(() => {
    return props.gf.families
        .filter(family => family.taggings.length === 0)
        .sort((a, b) => a.name.localeCompare(b.name));
});

// Load the CSS for the listed families so the names render in the font.
watch(untagged, (families) => {
    families.forEach(family => EventBus.$emit('ensure-loaded', family.name));
}, { immediate: true });

function addFontPanel(font: string) {
    EventBus.$emit('add-font-panel', font);
}
</script>
<template>
    <div>
        <h3>Untagged families</h3>
        <p v-if="untagged.length === 0">Every family has at least one tag.</p>
        <p v-else>{{ untagged.length }} of {{ props.gf.families.length }} families have no tags.</p>
        <ul class="untagged-list">
            <li v-for="family in untagged" :key="family.name">
                <span class="untagged-name" :style="{ fontFamily: family.name }">{{ family.name }}</span>
                <span class="untagged-axes" v-if="family.isVF">{{ family.axes.map(a => a.tag).join(', ') }}</span>
                <button @click="addFontPanel(family.name)">Tag it</button>
            </li>
        </ul>
    </div>
</template>
