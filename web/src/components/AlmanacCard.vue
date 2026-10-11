<script setup lang="ts">
// 图鉴小卡片：裁剪后的静态本体 + 名字；悬停弹出大图、属性与描述
import { HoverCard, HoverCardContent, HoverCardTrigger, SurfaceCard } from '@felinic/ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameAssets } from '@/composables/useGameAssets'
import type { AlmanacEntity } from '@/lib/pvz/almanac-entities'
import { parseDescription } from '@/lib/pvz/strings'
import AlmanacStage from './AlmanacStage.vue'
import EntityThumb from './game/EntityThumb.vue'

const props = defineProps<{
  entity: AlmanacEntity
  /** 存档编辑器里：这个用户还没遇到（变灰），或只见过剪影（变暗） */
  discovery?: 'hidden' | 'silhouette'
}>()

const { t } = useI18n()
const { assets } = useGameAssets()
const open = ref(false)

const name = computed(() => t(`almanac.names.${props.entity.key}`))

const description = computed(() => parseDescription(assets.value?.strings.get(`${props.entity.key}_DESCRIPTION`) ?? ''))
</script>

<template>
  <HoverCard
    v-model:open="open"
    :open-delay="150"
    :close-delay="80"
  >
    <HoverCardTrigger as-child>
      <!-- 卡片：草地背景上的本体（裁剪）+ 名字；悬停或弹出时整张卡片加一层遮罩 -->
      <SurfaceCard
        padding="none"
        tabindex="0"
        class="group relative select-none outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <EntityThumb
          :entity="entity"
          :label="name"
          class="aspect-square w-full transition-[filter]"
          :class="discovery === 'hidden' ? 'opacity-40 grayscale' : discovery === 'silhouette' ? 'opacity-70 grayscale' : ''"
        />
        <p
          class="truncate px-1.5 py-1.5 text-center text-body"
          :class="discovery ? 'text-muted-foreground' : 'text-foreground'"
        >
          {{ discovery === 'hidden' ? t('editor.almanac.unknown') : name }}
        </p>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 rounded-[inherit] transition-colors group-hover:bg-(--action-card-hover) group-data-[state=open]:bg-(--action-card-hover)"
        />
      </SurfaceCard>
    </HoverCardTrigger>

    <HoverCardContent
      side="right"
      align="center"
      :align-offset="0"
      class="w-60 overflow-hidden p-0"
    >
      <!-- 只在打开时挂载，动画随之启停；草地贴边，文字区单独留白 -->
      <template v-if="open">
        <AlmanacStage :entity="entity" />

        <div class="space-y-2.5 p-3">
          <div>
            <p class="text-control font-semibold text-foreground">
              {{ name }}
            </p>
            <p
              v-for="(line, index) in description.intro"
              :key="index"
              class="mt-0.5 text-body text-muted-foreground"
            >
              {{ line }}
            </p>
          </div>

          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body">
            <template v-if="entity.kind === 'plant' && entity.cost !== null">
              <dt class="text-accent-brown">
                {{ t('almanac.cost') }}
              </dt>
              <dd class="text-accent-red tabular-nums">
                {{ entity.cost }}
              </dd>
              <dt class="text-accent-brown">
                {{ t('almanac.recharge') }}
              </dt>
              <dd class="text-accent-red">
                {{ t(`almanac.rechargeValue.${entity.recharge}`) }}
              </dd>
            </template>
            <template
              v-for="(attribute, index) in description.attributes"
              :key="index"
            >
              <dt class="text-accent-brown">
                {{ attribute.label }}
              </dt>
              <dd class="text-accent-red">
                {{ attribute.value }}
                <span
                  v-if="attribute.number"
                  class="text-muted-foreground tabular-nums"
                >{{ t('almanac.hp', { value: attribute.number }) }}</span>
              </dd>
            </template>
          </dl>

          <p
            v-for="(trait, index) in description.traits"
            :key="`trait-${index}`"
            class="text-body text-accent-purple"
          >
            {{ trait }}
          </p>
        </div>
      </template>
    </HoverCardContent>
  </HoverCard>
</template>
