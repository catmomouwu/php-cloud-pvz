<script setup lang="ts">
// 禅境花园：主花园、蘑菇园、水族馆、手推车里的盆栽，以及智慧树和蜗牛。
// 每盆可以改生长阶段、搬到别的花园或移除；每个花园可以添加新植物（放到第一个空位）。
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  NumberField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsRow,
  SettingsSection,
  Switch,
  toast,
} from '@felinic/ui'
import { TREE_OF_WISDOM_MODE } from '@shared/pvz/challenges'
import type { PlayerData } from '@shared/pvz/player-data'
import { purchasedValue, STORE_ITEM } from '@shared/pvz/store'
import {
  addPottedPlant,
  canPlace,
  careForAll,
  freeSpots,
  GARDEN_PURCHASE,
  GARDENS,
  type GardenKind,
  gardenSpots,
  isGardenOwned,
  listPottedPlants,
  MARIGOLD_COLORS,
  movePottedPlant,
  PLANT_AGES,
  type PlantAge,
  removePottedPlant,
  setMarigoldColor,
  setPlantAge,
  ZEN_SEEDS,
} from '@shared/pvz/zen-garden'
import { ArrowRightLeft, Ellipsis, Plus, Trash2 } from 'lucide-vue-next'
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EntityThumb from '@/components/game/EntityThumb.vue'
import GardenScene from '@/components/game/GardenScene.vue'
import IconTile from '@/components/game/IconTile.vue'
import MarigoldColorPicker from '@/components/game/MarigoldColorPicker.vue'
import PlantPicker from '@/components/game/PlantPicker.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProfileEditor } from '@/composables/useProfileEditor'
import { PLANTS } from '@/lib/pvz/almanac-entities'
import EditorItem from './EditorItem.vue'

const props = defineProps<{
  data: PlayerData
}>()

const { t } = useI18n()
const editor = useProfileEditor()

const plantName = (seed: number) => t(`almanac.names.${PLANTS[seed]?.key ?? 'PEASHOOTER'}`)

const gardens = computed(() => {
  const plants = listPottedPlants(props.data)
  return GARDENS.map(garden => ({
    garden,
    owned: isGardenOwned(props.data, garden),
    capacity: gardenSpots(garden).length,
    free: freeSpots(props.data, garden).length,
    plants: plants.filter(plant => plant.garden === garden),
    seeds: ZEN_SEEDS.filter(seed => canPlace(seed, garden)),
  }))
})

/** 每个花园“添加植物”下拉框当前选的品种 */
const picked = reactive<Record<GardenKind, number>>({ main: 0, mushroom: 8, aquarium: 16, wheelbarrow: 0 })

function buyGarden(garden: GardenKind, value: boolean) {
  const item = GARDEN_PURCHASE[garden]
  if (!item) return
  editor.apply((data) => {
    data.purchases[STORE_ITEM[item]] = value ? purchasedValue(item) : 0
  })
}

function add(garden: GardenKind) {
  editor.apply(data => void addPottedPlant(data, picked[garden], garden))
}

function move(index: number, garden: GardenKind) {
  let moved = false
  editor.apply((data) => {
    moved = movePottedPlant(data, index, garden)
  })
  if (!moved) toast.error(t('editor.garden.moveFailed', { garden: t(`editor.garden.gardens.${garden}`) }))
}

const tree = computed({
  get: () => props.data.challengeRecords[TREE_OF_WISDOM_MODE - 1] ?? 0,
  set: (value: number | undefined) => editor.apply((data) => {
    data.challengeRecords[TREE_OF_WISDOM_MODE - 1] = Math.max(0, Math.round(value ?? 0))
  }),
})
const treeOwned = computed(() => (props.data.purchases[STORE_ITEM.treeOfWisdom] ?? 0) > 0)
const snailOwned = computed(() => (props.data.purchases[STORE_ITEM.stinkyTheSnail] ?? 0) > 0)

function buy(key: 'treeOfWisdom' | 'stinkyTheSnail', value: boolean) {
  editor.apply((data) => {
    data.purchases[STORE_ITEM[key]] = value ? purchasedValue(key) : 0
    if (key === 'treeOfWisdom' && value && !data.challengeRecords[TREE_OF_WISDOM_MODE - 1]) data.challengeRecords[TREE_OF_WISDOM_MODE - 1] = 1
  })
}

const confirmation = useConfirm()

function askAll(key: 'growAll' | 'careAll', change: (data: PlayerData) => void) {
  const action = t(`editor.garden.${key}`)
  confirmation.ask({
    title: t('editor.confirm.title', { action }),
    description: t('editor.confirm.description', { description: t(`editor.garden.${key}Hint`) }),
    confirmLabel: t('editor.overview.apply'),
    run: () => editor.apply(change),
  })
}

function growAll(data: PlayerData) {
  data.pottedPlants.forEach((_, index) => setPlantAge(data, index, 'full'))
}
</script>

<template>
  <div class="space-y-8">
    <SettingsSection :title="t('editor.garden.actions')">
      <SettingsRow
        :label="t('editor.garden.growAll')"
        :description="t('editor.garden.growAllHint')"
        stack="sm"
      >
        <Button
          variant="secondary"
          size="sm"
          :disabled="editor.readonly.value || data.pottedPlants.length === 0"
          @click="askAll('growAll', growAll)"
        >
          {{ t('editor.overview.apply') }}
        </Button>
      </SettingsRow>
      <SettingsRow
        :label="t('editor.garden.careAll')"
        :description="t('editor.garden.careAllHint')"
        stack="sm"
      >
        <Button
          variant="secondary"
          size="sm"
          :disabled="editor.readonly.value || data.pottedPlants.length === 0"
          @click="askAll('careAll', careForAll)"
        >
          {{ t('editor.overview.apply') }}
        </Button>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection
      v-for="group in gardens"
      :key="group.garden"
      :title="`${t(`editor.garden.gardens.${group.garden}`)} · ${group.plants.length} / ${group.capacity}`"
    >
      <SettingsRow
        v-if="GARDEN_PURCHASE[group.garden]"
        :label="t('editor.garden.owned')"
        :description="group.owned ? undefined : t('editor.garden.notOwned')"
        stack="sm"
      >
        <Switch
          :model-value="group.owned"
          :disabled="editor.readonly.value"
          :aria-label="t('editor.garden.owned')"
          @update:model-value="value => buyGarden(group.garden, value)"
        />
      </SettingsRow>

      <!-- 花园画面：手推车只有一格，不画 -->
      <div
        v-if="group.garden !== 'wheelbarrow' && group.owned"
        class="px-4 pt-4"
      >
        <GardenScene
          :garden="group.garden"
          :plants="group.plants"
          :label="t(`editor.garden.gardens.${group.garden}`)"
        />
      </div>

      <!-- 每盆有颜色、生长阶段和更多操作，单列排放，名字才放得下 -->
      <div
        v-if="group.plants.length > 0"
        class="grid grid-cols-1 px-4 py-2"
      >
        <EditorItem
          v-for="plant in group.plants"
          :key="plant.index"
          :label="plantName(plant.seed)"
          :hint="t('editor.garden.position', { x: plant.x + 1, y: plant.y + 1 })"
        >
          <template #icon>
            <IconTile>
              <EntityThumb
                :key="`${plant.seed}-${plant.marigoldColor}`"
                :entity="PLANTS[plant.seed]!"
                :colors="plant.marigoldColor === null ? undefined : [{ match: 'Marigold_petals', exact: true, color: MARIGOLD_COLORS[plant.marigoldColor]! }]"
                class="size-full"
              />
            </IconTile>
          </template>
          <MarigoldColorPicker
            v-if="plant.marigoldColor !== null"
            :model-value="plant.marigoldColor"
            :disabled="editor.readonly.value"
            @update:model-value="value => editor.apply(data => setMarigoldColor(data, plant.index, value))"
          />
          <Select
            :model-value="plant.age"
            :disabled="editor.readonly.value"
            @update:model-value="value => editor.apply(data => setPlantAge(data, plant.index, value as PlantAge))"
          >
            <SelectTrigger
              size="sm"
              class="w-24"
              :aria-label="t('editor.garden.age')"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="age in PLANT_AGES"
                :key="age"
                :value="age"
              >
                {{ t(`editor.garden.ages.${age}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="editor.readonly.value"
                :aria-label="t('editor.backup.more')"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <template
                v-for="target in GARDENS"
                :key="target"
              >
                <DropdownMenuItem
                  v-if="target !== group.garden && isGardenOwned(data, target) && canPlace(plant.seed, target)"
                  @select="move(plant.index, target)"
                >
                  <ArrowRightLeft />
                  {{ t('editor.garden.moveTo', { garden: t(`editor.garden.gardens.${target}`) }) }}
                </DropdownMenuItem>
              </template>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                @select="editor.apply(data => removePottedPlant(data, plant.index))"
              >
                <Trash2 />
                {{ t('editor.garden.remove') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </EditorItem>
      </div>

      <SettingsRow
        :label="t('editor.garden.add')"
        :description="group.free === 0 ? t('editor.garden.full') : undefined"
        stack="sm"
      >
        <div class="flex items-center gap-2">
          <PlantPicker
            v-model="picked[group.garden]"
            :seeds="group.seeds"
            :disabled="editor.readonly.value || group.free === 0 || !group.owned"
            :label="t('editor.garden.add')"
          />
          <Button
            variant="secondary"
            size="sm"
            :disabled="editor.readonly.value || group.free === 0 || !group.owned"
            @click="add(group.garden)"
          >
            <Plus />
            {{ t('editor.garden.addButton') }}
          </Button>
        </div>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('editor.garden.others')">
      <SettingsRow
        :label="t('editor.shop.items.treeOfWisdom')"
        :description="t('editor.garden.treeHint')"
        stack="sm"
      >
        <div class="flex items-center gap-3">
          <NumberField
            v-if="treeOwned"
            v-model="tree"
            class="w-32"
            size="sm"
            :min="0"
            :max="9999"
            :suffix="t('editor.garden.feet')"
            :disabled="editor.readonly.value"
            :aria-label="t('editor.garden.treeHeight')"
          />
          <Switch
            :model-value="treeOwned"
            :disabled="editor.readonly.value"
            :aria-label="t('editor.garden.owned')"
            @update:model-value="value => buy('treeOfWisdom', value)"
          />
        </div>
      </SettingsRow>
      <SettingsRow
        :label="t('editor.shop.items.stinkyTheSnail')"
        :description="t('editor.garden.snailHint')"
        stack="sm"
      >
        <Switch
          :model-value="snailOwned"
          :disabled="editor.readonly.value"
          :aria-label="t('editor.garden.owned')"
          @update:model-value="value => buy('stinkyTheSnail', value)"
        />
      </SettingsRow>
    </SettingsSection>

    <ConfirmDialog
      v-model:open="confirmation.open.value"
      :title="confirmation.request.value?.title ?? ''"
      :description="confirmation.request.value?.description"
      :confirm-label="confirmation.request.value?.confirmLabel ?? ''"
      :cancel-label="t('saves.cancel')"
      :destructive="confirmation.request.value?.destructive"
      @confirm="confirmation.confirm"
    />
  </div>
</template>
