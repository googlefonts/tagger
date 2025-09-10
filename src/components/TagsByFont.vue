<script lang="ts">
import type { Tagging } from '@/models';
</script>

<script setup lang="ts">
import { EventBus } from '@/eventbus';
import { GF } from '@/models';
import { StaticTagging } from '@/models';
import { computed, defineProps, onBeforeMount, onBeforeUpdate, ref } from 'vue';

const props = defineProps({
  font: {
    type: String,
    required: true
  },
  gf: {
    type: GF,
    required: true
  },
  showUndefined: {
    type: Boolean,
    default: false
  }
});


const newTag = ref<string | null>(null);
const newTagScore = ref<number | null>(null);
const newTagType = ref<'global' | 'variable'>('global');
const fontSize = ref(32);

// Props just gets us started, Vue gets mad at us if we change it during the
// select box. So make our own copy and use that everywhere.
const font = ref(props.font);

const selectedFamily = computed(() => {
  const familyName = font.value;
  return props.gf.family(familyName);
});

const location = computed(() => {
  return selectedFamily.value?.axes.reduce((acc, axis) => {
    if (axis.displayValue) {
      // @ts-ignore // It's typed to be a number, but Vue stuffs it in as a string
      acc[axis.tag] = parseFloat(axis.displayValue);
    }
    return acc;
  }, {} as Record<string, number>);
});

const similarFamilies = computed(() => {
  return props.gf.similarFamilies(font.value, 10) || [];
});

const lintErrors = computed(() => {
  if (!selectedFamily.value) return [];
  return props.gf.linter(props.gf.lintRules, selectedFamily.value) || [];
});

function removeTagging(tag: Tagging) {
  tag.font.removeTagging(tag);
}
function addFontPanel(font: string) {
  console.log("Emitting add-font-panel from TagsByFont for ", font);
  EventBus.$emit('add-font-panel', font);
}


onBeforeMount(() => {
  // Ensure the font is included in the CSS
  EventBus.$emit('ensure-loaded', font.value);
  similarFamilies.value.forEach(family => {
    props.gf?.ensureLoaded(family);
  });
});

onBeforeUpdate(() => {
  // Ensure the font is included in the CSS
  EventBus.$emit('ensure-loaded', font.value);
  similarFamilies.value.forEach(family => {
    props.gf?.ensureLoaded(family);
  });
});

const unappliedTaggings = computed(() => {
  if (!selectedFamily.value) return [];
  let unappliedTags = props.gf?.uniqueTagNames().filter(tagName => !selectedFamily.value!.hasTagging(tagName)) || [];
  return unappliedTags.map(tagName => new StaticTagging(selectedFamily.value!, props.gf.tags[tagName], null));
});

const addToFamily = (tagging: Tagging) => {
  selectedFamily.value?.addTagging(tagging);
};

</script>
<template>
  <div>
    <h3>Tags for:</h3>
    <v-select v-model="font" :options="props.gf.families.map(f => f.name)"></v-select>
    <div>
      <label>Font size:</label>
      <input type="range" v-model="fontSize" min="8" max="100" default="32" /> {{ fontSize }}pt
    </div>
    <sample-text :font="selectedFamily" :fontSize="fontSize" />
    <ul>
      <li v-for="tagging in selectedFamily?.taggings" :key="tagging.tag.name + selectedFamily?.name">
        <span class="tag-name">{{ tagging.tag.name }}
          <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -1000 960 960" width="24px" fill="#000000">
            <path
              d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
          </svg>
        </span>
        <span v-if="'scores' in tagging" class="variable-tag tag-score">
          Variable tag
          <input type="number" v-if="location && tagging.scoreAt(location)" :value="tagging.scoreAt(location)" />
          <span class="undefined" v-if="location && !tagging.scoreAt(location)">not defined at this location</span>
        </span>
        <input type="number" v-model="tagging.score" v-if="!('scores' in tagging)"
          @change="EventBus.$emit('update:tags', selectedFamily?.taggings)" />
        <button @click="removeTagging(tagging)">Remove</button>
      </li>
    </ul>
    <ul v-if="showUndefined">
      <li v-for="tagging in unappliedTaggings" :key="tagging.tag.name + selectedFamily?.name">
        <span class="tag-name unapplied">{{ tagging.tag.name }}</span>
        <span class="tag-score">
          <input type="number" v-model.lazy="tagging.score" style="width: 60px;" min="0" max="100" step="10"
            v-on:change="addToFamily(tagging)" placeholder="Score" />
        </span>
      </li>
    </ul>
    <!-- add another -->
    <div v-if="!showUndefined">
      Add
      <select v-model="newTagType" class="inline-block" v-if="selectedFamily?.isVF">
        <option value="global">global</option>
        <option value="variable">variable</option>
      </select>

      tag: <v-select v-model="newTag"
        :options="props.gf.uniqueTagNames().filter(tagName => !selectedFamily?.hasTagging(tagName))"
        placeholder="Add a tag" class="inline-block">
        <template #search="{ attributes, events }">
          <input class="vs__search" :required="true" v-bind="attributes" v-on="events" />
        </template></v-select>
      <!-- a global tag-->
      <div v-if="newTag && newTagType === 'global'">
        <add-static-tag :font="selectedFamily" :gf="props.gf" :new-tag="newTag" />
      </div>

      <div v-if="newTag && selectedFamily?.isVF && newTagType === 'variable'" class="vf-tag">
        <add-variable-tag :font="selectedFamily" :gf="props.gf" :new-tag="newTag" />
      </div>
    </div>

    <h3 v-if="similarFamilies.length">Similar families</h3>
    <ul :key="similarFamilies.join('-')">
      <li v-for="family in similarFamilies" :key="family" :style="{ fontFamily: family }">
        {{ family }} <button @click="addFontPanel(family)">Add</button>
      </li>
    </ul>
    <h3 v-if="lintErrors.length">Warnings</h3>
    <ul>
      <li v-for="error in lintErrors" :key="error.description"
        :class="{ 'tag-error': error.severity === 'ERROR', 'tag-warn': error.severity === 'WARN', 'tag-fail': error.severity === 'FAIL', 'tag-info': error.severity === 'INFO' }">
        {{ error.description }}
      </li>
    </ul>
  </div>
</template>