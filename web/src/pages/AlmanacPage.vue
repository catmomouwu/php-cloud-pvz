<script setup lang="ts">
import { CalloutBanner, InlineLoadingRow, PageShell, Tabs, TabsContent, TabsList, TabsTrigger } from '@felinic/ui'
import { useI18n } from 'vue-i18n'
import AlmanacCard from '@/components/AlmanacCard.vue'
import PageScroll from '@/components/PageScroll.vue'
import { useGameAssets } from '@/composables/useGameAssets'
import { PLANTS, ZOMBIES } from '@/lib/pvz/almanac-entities'

const { t } = useI18n()
const { state } = useGameAssets()
</script>

<template>
  <PageScroll>
    <PageShell
      :title="t('almanac.title')"
    >
      <InlineLoadingRow v-if="state === 'idle' || state === 'loading'">
        {{ t('almanac.loading') }}
      </InlineLoadingRow>

      <CalloutBanner
        v-else-if="state === 'missing'"
        tone="warning"
        :title="t('game.errors.missingResourcesTitle')"
        :description="t('almanac.missing')"
      />

      <CalloutBanner
        v-else-if="state === 'error'"
        tone="destructive"
        :description="t('almanac.failed')"
      />

      <Tabs
        v-else
        default-value="plants"
      >
        <TabsList>
          <TabsTrigger value="plants">
            {{ t('almanac.plants', { count: PLANTS.length }) }}
          </TabsTrigger>
          <TabsTrigger value="zombies">
            {{ t('almanac.zombies', { count: ZOMBIES.length }) }}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="plants"
          class="pt-4"
        >
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-7">
            <AlmanacCard
              v-for="entity in PLANTS"
              :key="entity.key"
              :entity="entity"
            />
          </div>
        </TabsContent>
        <TabsContent
          value="zombies"
          class="pt-4"
        >
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-7">
            <AlmanacCard
              v-for="entity in ZOMBIES"
              :key="entity.key"
              :entity="entity"
            />
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  </PageScroll>
</template>
