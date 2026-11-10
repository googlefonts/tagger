<script setup lang="ts">
import type { ComputedRef } from 'vue';
import { computed, ref, defineProps } from 'vue';
import { GF, StaticTagging, VariableTagging } from '../models';
import type { Tagging } from '../models';

const props = defineProps({
  gf: {
    type: GF,
    required: true
  },
  categories: {
    type: Array as () => string[],
    required: true
  },
  showUndefined: {
    type: Boolean,
    default: false
  },
  vfDisplayMode: {
    type: String as () => 'animated' | 'list',
    default: 'animated'
  },
  // Initial state of the controls, for panels opened with a preset
  initialSortBy: {
    type: String,
    default: 'family'
  },
  initialScriptFilter: {
    type: Array as () => string[],
    default: () => []
  },
  initialPlaceholdersOnly: {
    type: Boolean,
    default: false
  }
});

const selectedCategories = ref<string[]>(props.categories);
const sortBy = ref(props.initialSortBy);
const tagFilter = ref('');
const axisFilter = ref('');
const reverseTags = ref(false);
const variableOnly = ref(false);
const staticOnly = ref(false);
const scriptFilter = ref<string[]>([...props.initialScriptFilter]);
const placeholdersOnly = ref(props.initialPlaceholdersOnly);
const sampleText = ref('');

// Every script any font supports, from the family metadata subsets
const scriptOptions = computed(() => {
  const scripts = new Set<string>();
  for (const family of props.gf.families) {
    for (const script of family.subsets) scripts.add(script);
  }
  return [...scripts].sort();
});

const unappliedTaggings: ComputedRef<Tagging[]> = computed(() => {
  if (!selectedCategories.value) return [];
  let tags = [];
  for (const category of selectedCategories.value) {
    // Find fonts without this tag
    for (const f of props.gf?.families.filter(f => !f.hasTagging(category))) {
      tags.push(new StaticTagging(f, props.gf!.tags[category], null));
    }
  }
  return tags;
});

const filteredTaggings: ComputedRef<Tagging[]> = computed(() => {
  let filtered = props.gf?.allTaggings.filter(tagging =>
    selectedCategories.value.includes(tagging.tag.name)
  ) || [];
  if (props.showUndefined) {
    filtered = filtered.concat(unappliedTaggings.value);
  }
  if (sortBy.value === 'score') {
    const sortScore = (t: Tagging) => {
      if ('scores' in t) {
        const scores = t.scores.map(s => s.score);
        if (scores.length === 0) return 0;
        // Rank each variable tagging by the extreme of its whole set of points
        // (including any midpoints): its peak when sorting high→low, its valley
        // when sorting low→high.
        return reverseTags.value ? Math.min(...scores) : Math.max(...scores);
      }
      return t.score || 0;
    };
    filtered = filtered.sort((a, b) => sortScore(b) - sortScore(a));
  }
  if (sortBy.value === 'family') {
    filtered = filtered.sort((a, b) => {
      if (a.font.name < b.font.name) return -1;
      if (a.font.name > b.font.name) return 1;
      if (a.tag.name < b.tag.name) return -1;
      if (a.tag.name > b.tag.name) return 1;
      return 0;
    });
  }
  if (sortBy.value === 'popularity' || sortBy.value === 'trending') {
    const familyData = props.gf.familyData;
    filtered = filtered.sort((a, b) => {
      const aVal = Number(familyData[a.font.name]?.[sortBy.value]) || 0;
      const bVal = Number(familyData[b.font.name]?.[sortBy.value]) || 0;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
  }

  if (variableOnly.value) {
    filtered = filtered.filter(t => t instanceof VariableTagging);
  }
  if (staticOnly.value) {
    filtered = filtered.filter(t => t instanceof StaticTagging);
  }
  if (tagFilter.value !== "") {
    const myRegex = new RegExp(tagFilter.value, "i");
    filtered = filtered.filter(tag => myRegex.test(tag.font.name));
  }
  if (axisFilter.value !== "") {
    const axes = axisFilter.value.split(",").map(a => a.trim().toLowerCase()).filter(Boolean);
    filtered = filtered.filter(t => axes.every(a => t.font.axes.some(ax => ax.tag.toLowerCase() === a)));
  }
  if (placeholdersOnly.value) {
    filtered = filtered.filter(t => t.placeholder);
  }
  if (scriptFilter.value.length > 0) {
    // Keep fonts that support any of the chosen scripts
    filtered = filtered.filter(t => scriptFilter.value.some(s => t.font.subsets.includes(s)));
  }
  if (reverseTags.value) {
    filtered.reverse();
  }
  return filtered;
});
</script>
<template>
  <div>
    <h3>Tags for categories:</h3>
    <div>
      <v-select v-model="selectedCategories" multiple :options="gf.uniqueTagNames().sort()"></v-select>
      <label for="sortBy">Sort by:</label>
      <select id="sortBy" v-model="sortBy">
        <option value="family">Family</option>
        <option value="score">Score</option>
        <option value="popularity">Popularity</option>
        <option value="trending">Trending</option>
      </select>
      <button @click="reverseTags = !reverseTags">
        Reverse Order
      </button>
      <input type="text" v-model="tagFilter" placeholder="Filter by font name" />
      <input type="text" v-model="axisFilter" placeholder="Filter by axes (e.g. wght,wdth)" />
      <v-select multiple v-model="scriptFilter" :options="scriptOptions" placeholder="Filter by script"
        class="inline-block script-select"></v-select>
      <label><input type="checkbox" v-model="variableOnly" :disabled="staticOnly" /> Variable only</label>
      <label><input type="checkbox" v-model="staticOnly" :disabled="variableOnly" /> Static only</label>
      <label><input type="checkbox" v-model="placeholdersOnly" /> Placeholders only</label>
      <input type="text" v-model="sampleText" placeholder="Sample text for all previews" class="sample-text-input" />
    </div>
    <div v-for="tagging in filteredTaggings" :key="tagging.font.name + tagging.tag.name + tagging.scripts.join('|')">
      <tag-view :tagging="tagging" :vfDisplayMode="props.vfDisplayMode" :sampleText="sampleText"></tag-view>
    </div>
  </div>
</template>