<script setup lang="ts">
// 商店：金币、卡槽、商店植物、工具与花园用品（一次性购买）、消耗品数量
import { NumberField, SettingsRow, SettingsSection, Switch } from '@felinic/ui'
import { MAX_COINS } from '@shared/pvz/player-edits'
import type { PlayerData } from '@shared/pvz/player-data'
import {
  BASE_SEED_SLOTS,
  consumableCount,
  consumableValue,
  MAX_PACKET_UPGRADES,
  MAX_RAKE_USES,
  purchasedValue,
  STORE_CONSUMABLES,
  STORE_ICONS,
  STORE_ITEM,
  STORE_PLANTS,
  STORE_UPGRADES,
  type StoreItemKey,
} from '@shared/pvz/store'
import { TREE_OF_WISDOM_MODE } from '@shared/pvz/challenges'
import { displayCoins } from '@shared/pvz/userdata'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProfileEditor } from '@/composables/useProfileEditor'
import { PLANTS } from '@/lib/pvz/almanac-entities'
import GameImage from '@/components/game/GameImage.vue'
import IconTile from '@/components/game/IconTile.vue'
import SeedPacket from '@/components/game/SeedPacket.vue'
import EditorItem from './EditorItem.vue'

const props = defineProps<{
  data: PlayerData
}>()

const { t } = useI18n()
const editor = useProfileEditor()

/** 商店植物在图鉴里的名字：第 40 种起 */
const plantNameKey = (index: number) => `almanac.names.${PLANTS[40 + index]!.key}`

const coins = computed({
  get: () => displayCoins(props.data.coins),
  set: (value: number | undefined) => editor.apply((data) => {
    data.coins = Math.min(Math.max(Math.round((value ?? 0) / 10), 0), MAX_COINS)
  }),
})

const slots = computed({
  get: () => BASE_SEED_SLOTS + (props.data.purchases[STORE_ITEM.packetUpgrade] ?? 0),
  set: (value: number | undefined) => editor.apply((data) => {
    data.purchases[STORE_ITEM.packetUpgrade] = Math.min(Math.max((value ?? BASE_SEED_SLOTS) - BASE_SEED_SLOTS, 0), MAX_PACKET_UPGRADES)
  }),
})

const rake = computed({
  get: () => props.data.purchases[STORE_ITEM.rake] ?? 0,
  set: (value: number | undefined) => editor.apply((data) => {
    data.purchases[STORE_ITEM.rake] = Math.min(Math.max(Math.round(value ?? 0), 0), MAX_RAKE_USES)
  }),
})

const owned = (key: StoreItemKey) => (props.data.purchases[STORE_ITEM[key]] ?? 0) > 0

function setOwned(key: StoreItemKey, value: boolean) {
  editor.apply((data) => {
    data.purchases[STORE_ITEM[key]] = value ? (owned(key) ? data.purchases[STORE_ITEM[key]]! : purchasedValue(key)) : 0
    // 买智慧树时游戏会把高度设为 1
    if (key === 'treeOfWisdom' && value && !data.challengeRecords[TREE_OF_WISDOM_MODE - 1]) data.challengeRecords[TREE_OF_WISDOM_MODE - 1] = 1
  })
}

function setCount(key: StoreItemKey, count: number | undefined) {
  editor.apply((data) => {
    const index = STORE_ITEM[key]
    data.purchases[index] = consumableValue(data.purchases[index] ?? 0, Math.round(count ?? 0))
  })
}

const TOOLS: StoreItemKey[] = ['poolCleaner', 'roofCleaner', 'firstAid']
const GARDEN = STORE_UPGRADES.filter(key => !TOOLS.includes(key))
</script>

<template>
  <div class="space-y-8">
    <SettingsSection :title="t('editor.shop.basics')">
      <SettingsRow
        :label="t('editor.shop.coins')"
        :description="t('editor.shop.coinsHint')"
        stack="sm"
      >
        <NumberField
          v-model="coins"
          class="w-40"
          size="sm"
          :min="0"
          :max="MAX_COINS * 10"
          :step="10"
          :format-options="{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }"
          :disabled="editor.readonly.value"
        />
      </SettingsRow>
      <SettingsRow
        :label="t('editor.shop.slots')"
        :description="t('editor.shop.slotsHint')"
        stack="sm"
      >
        <NumberField
          v-model="slots"
          class="w-32"
          size="sm"
          :min="BASE_SEED_SLOTS"
          :max="BASE_SEED_SLOTS + MAX_PACKET_UPGRADES"
          :disabled="editor.readonly.value"
        />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('editor.shop.plants')">
      <div class="grid grid-cols-1 gap-x-6 px-4 py-2 sm:grid-cols-2">
        <EditorItem
          v-for="(key, index) in STORE_PLANTS"
          :key="key"
          :label="t(plantNameKey(index))"
        >
          <template #icon>
            <IconTile>
              <SeedPacket
                :seed="40 + index"
                :label="t(plantNameKey(index))"
                class="h-9 w-[26px]"
                :class="owned(key) ? '' : 'opacity-50 grayscale'"
              />
            </IconTile>
          </template>
          <Switch
            :model-value="owned(key)"
            :disabled="editor.readonly.value"
            :aria-label="t(plantNameKey(index))"
            @update:model-value="value => setOwned(key, value)"
          />
        </EditorItem>
      </div>
    </SettingsSection>

    <SettingsSection :title="t('editor.shop.tools')">
      <div class="grid grid-cols-1 gap-x-6 px-4 py-2 sm:grid-cols-2">
        <EditorItem
          v-for="key in TOOLS"
          :key="key"
          :label="t(`editor.shop.items.${key}`)"
        >
          <template #icon>
            <IconTile>
              <GameImage
                :image="STORE_ICONS[key]!"
                :label="t(`editor.shop.items.${key}`)"
                class="size-8"
                :class="owned(key) ? '' : 'opacity-50 grayscale'"
              />
            </IconTile>
          </template>
          <Switch
            :model-value="owned(key)"
            :disabled="editor.readonly.value"
            :aria-label="t(`editor.shop.items.${key}`)"
            @update:model-value="value => setOwned(key, value)"
          />
        </EditorItem>
        <EditorItem
          :label="t('editor.shop.items.rake')"
          :hint="t('editor.shop.rakeHint')"
        >
          <template #icon>
            <IconTile>
              <GameImage
                :image="STORE_ICONS.rake!"
                :label="t('editor.shop.items.rake')"
                class="size-8"
                :class="rake > 0 ? '' : 'opacity-50 grayscale'"
              />
            </IconTile>
          </template>
          <NumberField
            v-model="rake"
            class="w-24 shrink-0"
            size="sm"
            :min="0"
            :max="MAX_RAKE_USES"
            :disabled="editor.readonly.value"
          />
        </EditorItem>
      </div>
    </SettingsSection>

    <SettingsSection :title="t('editor.shop.garden')">
      <div class="grid grid-cols-1 gap-x-6 px-4 py-2 sm:grid-cols-2">
        <EditorItem
          v-for="key in GARDEN"
          :key="key"
          :label="t(`editor.shop.items.${key}`)"
        >
          <template #icon>
            <IconTile>
              <GameImage
                :image="STORE_ICONS[key]!"
                :label="t(`editor.shop.items.${key}`)"
                class="size-8"
                :class="owned(key) ? '' : 'opacity-50 grayscale'"
              />
            </IconTile>
          </template>
          <Switch
            :model-value="owned(key)"
            :disabled="editor.readonly.value"
            :aria-label="t(`editor.shop.items.${key}`)"
            @update:model-value="value => setOwned(key, value)"
          />
        </EditorItem>
      </div>
    </SettingsSection>

    <SettingsSection :title="t('editor.shop.consumables')">
      <div class="grid grid-cols-1 gap-x-6 px-4 py-2 sm:grid-cols-2">
        <EditorItem
          v-for="item in STORE_CONSUMABLES"
          :key="item.key"
          :label="t(`editor.shop.items.${item.key}`)"
        >
          <template #icon>
            <IconTile>
              <GameImage
                :image="STORE_ICONS[item.key]!"
                :label="t(`editor.shop.items.${item.key}`)"
                class="size-8"
              />
            </IconTile>
          </template>
          <NumberField
            :model-value="consumableCount(data.purchases[STORE_ITEM[item.key]] ?? 0)"
            class="w-24 shrink-0"
            size="sm"
            :min="0"
            :max="item.max"
            :disabled="editor.readonly.value"
            :aria-label="t(`editor.shop.items.${item.key}`)"
            @update:model-value="value => setCount(item.key, value)"
          />
        </EditorItem>
      </div>
    </SettingsSection>
  </div>
</template>
