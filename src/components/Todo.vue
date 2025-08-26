<script setup lang="ts">
import { EventBus } from '@/eventbus';
import { Font, GF, StaticTagging, Tag } from '@/models';
import type { Exemplars } from '@/models';
import { computed, defineProps, ref, watch } from 'vue';

interface Untagged {
    font: Font;
    tagname: string;
    tag: Tag;
    exemplars: Exemplars
}

const props = defineProps({
    gf: {
        type: GF,
        required: true
    },
    categoryFilter: {
        type: String,
        required: false
    }
})

const newScore = ref(0);

function useRefreshable<T>(getter: () => T): {
    getter(): T;
    refresh(): void;
} {
    const refreshKey = ref(0);
    let cache: T | null = null;

    return {
        getter() {
            refreshKey.value;
            if (cache) {
                return cache;
            }
            const result: T = getter();
            cache = result;
            return result;
        },
        refresh() {
            refreshKey.value++;
            cache = null;
        },
    };
}

const tagNames = computed(() => {
    return props.gf.uniqueTagNames().filter(tagName => {
        // Don't include '/Quant/'
        return !tagName.startsWith('/quant/');
    });
});

const completeness = computed(() => {
    console.log("Calculating completeness...");
    const families = props.gf.families;
    if (props.categoryFilter) {
        return families.filter(family => family.hasTagging(props.categoryFilter!)).length / families.length * 100;
    }
    const uniqueTags = tagNames.value;
    const totalTaggings = families.map(family => family.taggings.length).reduce((a, b) => a + b, 0);
    return (totalTaggings / (families.length * uniqueTags.length)) * 100;
});

function getNextUntagged(): Untagged | null {
    const families = props.gf.families;
    const uniqueTags = tagNames.value;
    if (completeness.value >= 100) {
        return null; // All fonts are tagged
    }
    while (true) {
        // Grab a random family
        const family = families[Math.floor(Math.random() * families.length)];
        // Grab a random tagname
        const tagname = props.categoryFilter || uniqueTags[Math.floor(Math.random() * uniqueTags.length)];
        if (!props.gf.tags[tagname]) {
            console.warn("Tag with no definition!!", tagname);
            continue
        }
        // If the family is not tagged with the tagname, return it
        if (!family.hasTagging(tagname)) {
            EventBus.$emit('ensure-loaded', family.name);
            return {
                font: family,
                tagname: tagname,
                tag: props.gf.tags[tagname],
                exemplars: props.gf.tags[tagname].exemplars(props.gf)
            };
        }
    }
}

function tagIt(untagged: Untagged, score: number) {
    const family = untagged.font;
    const tag = props.gf.tags[untagged.tagname];
    if (!family || !tag) {
        console.error("Family or tag not found for tagging.");
        return;
    }
    const tagging = family.taggings.find(t => t.tag.name === tag.name);
    if (tagging) {
        console.log(`We already have a tagging for ${tag.name} in ${family.name}, can't happen.`);
        return;
    } else {
        family.addTagging(new StaticTagging(family, tag, score));
    }
    console.log(`There are now ` + props.gf.allTaggings.length + ` taggings in the GF.`);
}

function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        const untagged = randomUntagged.value;
        if (untagged) {
            tagIt(untagged, newScore.value);
            randomUntaggedRefreshable.refresh();
        }
    }
    if (randomUntagged.value && (
        parseInt(event.key, 10) >= 0 && parseInt(event.key, 10) <= 9
    )) {
        newScore.value = parseInt(event.key, 10) * 10;
    }
}

const randomUntaggedRefreshable = useRefreshable(getNextUntagged);
const randomUntagged = computed(randomUntaggedRefreshable.getter);

watch(() => props.categoryFilter, () => {
    randomUntaggedRefreshable.refresh();
});
</script>

<template>
    <div id="todo-wrapper" v-on:keyup="handleKeyPress" tabindex="0">
        <v-select v-model="categoryFilter"
        :options="props.gf.uniqueTagNames()"
        placeholder="Filter by category" class="inline-block"/>
        <div v-if="!randomUntagged">All fonts are tagged!</div>

        <div v-else>
            <div class="progressbar">
                <div class="progress" :style="{ width: completeness + '%' }">
                </div>
                <div class="progress-text">
                    Tagging is {{ completeness.toFixed(3) }}% complete<span v-if="props.categoryFilter"> in {{ props.categoryFilter }}</span>
                </div>
            </div>

            <h1>Is
                <span class="family" :style="{ fontFamily: randomUntagged.font.name }">{{ randomUntagged.font.name
                }}</span>
                a<span v-if="randomUntagged.tag.friendlyName.match(/^[aeiou]/)">n</span> {{ randomUntagged.tag.friendlyName }} font?

            </h1>
            <h3 v-if="randomUntagged.tag.superShortDescription">({{ randomUntagged.tag.superShortDescription }})</h3>

            <sample-text :font="randomUntagged.font" style="border: 1px solid #ccc; padding: 1em;" />

            <p v-html="randomUntagged.tag.description"></p>

            <h2 v-if="randomUntagged.font.isVF">This is a variable font.
                Only tag it using this panel if its tag value does not vary across the designspace.
            </h2>

            <div class="exemplars">
                <div class="exemplars-low" v-if="randomUntagged.exemplars.low.length">
                    <h3>Examples of <i>low</i> {{ randomUntagged.tagname }}</h3>
                    <div v-for="tagging in randomUntagged.exemplars.low"
                        :key="tagging.font.name + tagging.tag.name + tagging.score">
                        <compact-tag-view :tag="tagging"></compact-tag-view>
                    </div>
                </div>
                <div class="exemplars-medium" v-if="randomUntagged.exemplars.medium.length">
                    <h3>Examples of <i>medium</i> {{ randomUntagged.tagname }}</h3>
                    <div v-for="tag in randomUntagged.exemplars.medium" :key="tag.font.name + tag.tag.name + tag.score">
                        <compact-tag-view :tag="tag"></compact-tag-view>
                    </div>
                </div>
                <div class="exemplars-high" v-if="randomUntagged.exemplars.high.length">
                    <h3>Examples of <i>high</i> {{ randomUntagged.tagname }}</h3>
                    <div v-for="tag in randomUntagged.exemplars.high" :key="tag.font.name + tag.tag.name + tag.score">
                        <compact-tag-view :tag="tag"></compact-tag-view>
                    </div>
                </div>
            </div>

            <p>
            <div class="rangeslider">
                <input type="range" v-model="newScore" min="0" max="100" step="5" style="vertical-align: middle;">
                <span>0</span>
                <span>10</span>
                <span>20</span>
                <span>30</span>
                <span>40</span>
                <span>50</span>
                <span>60</span>
                <span>70</span>
                <span>80</span>
                <span>90</span>
                <span>100</span>
            </div>
            <input type="number" v-model="newScore" placeholder="Score (0-100)">
            <button @click="randomUntagged && tagIt(randomUntagged, newScore)">
                Tag it!</button>
            </p>

            <button @click="randomUntaggedRefreshable.refresh">Give me another</button>
        </div>
    </div>
</template>
