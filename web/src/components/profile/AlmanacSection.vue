<script setup lang="ts">
// 图鉴：这个用户已经遇到的植物和僵尸。游戏不单独记录，由冒险关卡和商店购买决定，所以这里只能查看
import { Button, CalloutBanner, InlineLoadingRow, Tabs, TabsContent, TabsList, TabsTrigger } from '@felinic/ui'
import { hasSeed, zombieDiscovery } from '@shared/pvz/discovery'
import type { PlayerData } from '@shared/pvz/player-data'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AlmanacCard from '@/components/AlmanacCard.vue'
import { useGameAssets } from '@/composables/useGameAssets'
import { PLANTS, ZOMBIES } from '@/lib/pvz/almanac-entities'

const props = defineProps<{
  data: PlayerData
}>()

const emit = defineEmits<{
  navigate: [section: 'adventure' | 'shop']
}>()

const { t } = useI18n()
const { state } = useGameAssets()

const plants = computed(() => PLANTS.map((entity, index) => ({ entity, owned: hasSeed(props.data, index) })))
const zombies = computed(() => ZOMBIES.map((entity, index) => ({ entity, discovery: zombieDiscovery(props.data, index) })))
const ownedPlants = computed(() => plants.value.filter(item => item.owned).length)
const seenZombies = computed(() => zombies.value.filter(item => item.discovery === 'shown').length)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="min-w-0 flex-1 text-body text-muted-foreground">
        {{ t('editor.almanac.hint') }}
      </p>
      <div class="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          @click="emit('navigate', 'adventure')"
        >
          {{ t('editor.almanac.toAdventure') }}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          @click="emit('navigate', 'shop')"
        >
          {{ t('editor.almanac.toShop') }}
        </Button>
      </div>
    </div>

    <InlineLoadingRow v-if="state === 'idle' || state === 'loading'">
      {{ t('almanac.loading') }}
    </InlineLoadingRow>

    <CalloutBanner
      v-else-if="state === 'missing' || state === 'error'"
      tone="warning"
      :description="state === 'missing' ? t('almanac.missing') : t('almanac.failed')"
    />

    <Tabs
      v-else
      default-value="plants"
    >
      <TabsList>
        <TabsTrigger value="plants">
          {{ t('editor.almanac.plants', { count: ownedPlants, total: PLANTS.length }) }}
        </TabsTrigger>
        <TabsTrigger value="zombies">
          {{ t('editor.almanac.zombies', { count: seenZombies, total: ZOMBIES.length }) }}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="plants"
        class="pt-4"
      >
        <div class="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          <AlmanacCard
            v-for="item in plants"
            :key="item.entity.key"
            :entity="item.entity"
            :discovery="item.owned ? undefined : 'hidden'"
          />
        </div>
      </TabsContent>
      <TabsContent
        value="zombies"
        class="pt-4"
      >
        <div class="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          <AlmanacCard
            v-for="item in zombies"
            :key="item.entity.key"
            :entity="item.entity"
            :discovery="item.discovery === 'shown' ? undefined : item.discovery"
          />
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
