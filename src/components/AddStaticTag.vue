<script setup lang="ts">
import { Font, GF, StaticTagging } from '@/models';
import { ref, watch } from 'vue';
const newTagScore = ref<number | null>(null);

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
    }
});

// Reset newTagScore when font or tag changes
watch(
    () => props.newTag,
    (_newValue, _oldValue) => {
        newTagScore.value = null;
    }
);
function addStaticTag() {
    if (!props.font || !props.newTag || newTagScore.value === null) return;
    const tag = props.gf.tags[props.newTag];
    if (!tag) {
        console.error("Tag not found:", props.newTag);
        return;
    }
    props.font.taggings.push(new StaticTagging(props.font, tag, newTagScore.value));
}
</script>

<template>
    <div>
        &nbsp;
        <input type="number" v-model="newTagScore" placeholder="Score (0-100)" />
        <button @click="addStaticTag()">Add tag</button>
    </div>
</template>