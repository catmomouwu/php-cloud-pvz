<script setup lang="ts">
// 用户详情 / 存档编辑器：内容在左，分类列表在右（窄屏在上）。各分类改的是同一份草稿，底部统一保存。
import {
  Button,
  CalloutBanner,
  Checkbox,
  ConfirmDeleteDialog,
  BackButton,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  PageHeader,
  SettingsShell,
  toast,
} from '@felinic/ui'
import { adventureArea } from '@shared/pvz/progress'
import { stageString } from '@shared/pvz/userdata'
import { useEventListener } from '@vueuse/core'
import { Play, Square } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, onBeforeRouteUpdate, type RouteLocationRaw, useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageScroll from '@/components/PageScroll.vue'
import ProfileMenu from '@/components/ProfileMenu.vue'
import AdventureSection from '@/components/profile/AdventureSection.vue'
import AlmanacSection from '@/components/profile/AlmanacSection.vue'
import BackupSection from '@/components/profile/BackupSection.vue'
import ChallengesSection from '@/components/profile/ChallengesSection.vue'
import GardenSection from '@/components/profile/GardenSection.vue'
import OverviewSection from '@/components/profile/OverviewSection.vue'
import ProfileSectionNav from '@/components/profile/ProfileSectionNav.vue'
import ShopSection from '@/components/profile/ShopSection.vue'
import { useLocalSaves } from '@/composables/useLocalSaves'
import { useGameSession } from '@/composables/useGameSession'
import { usePlayAs } from '@/composables/usePlayAs'
import { provideProfileEditor } from '@/composables/useProfileEditor'
import { isProfileSection, PROFILE_SECTIONS, type ProfileSection } from '@/lib/profile-sections'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const playAs = usePlayAs()
const session = useGameSession()
const stopOpen = ref(false)

async function stopGame() {
  stopOpen.value = false
  await session.stop()
}
const { profiles, loaded } = useLocalSaves()

const profile = computed(() => profiles.value.find(item => item.id === Number(route.params.id)) ?? null)
const editor = provideProfileEditor(profile)
const data = computed(() => editor.draft.value)

const section = computed<ProfileSection>(() => (isProfileSection(route.params.section) ? route.params.section : 'overview'))

// 用户被删除（菜单里删除，或其他设备删除后同步下来）时直接回到列表。
// 不能靠菜单的 deleted 事件：列表一刷新，菜单所在的分支就卸载了，事件没人接收
watch(profile, (current, previous) => {
  if (previous && !current && loaded.value) {
    editor.discard()
    void router.replace({ name: 'saves' })
  }
})

// 地址里的分类不认识时回到概览
watch(() => route.params.section, (value) => {
  if (value && !isProfileSection(value)) void router.replace({ name: 'profile', params: { id: route.params.id, section: 'overview' } })
}, { immediate: true })

function selectSection(next: ProfileSection) {
  if (next !== section.value) void router.push({ name: 'profile', params: { id: route.params.id, section: next } })
}

const description = computed(() => {
  if (!profile.value) return ''
  if (profile.value.detailsState === 'missing') return t('saves.noProgress')
  if (editor.unreadable.value || profile.value.detailsState === 'unreadable') return t('saves.unreadable')
  const { level, finishedAdventure } = data.value ?? profile.value.details!
  const stage = t('saves.stageArea', { stage: stageString(level), area: t(`saves.area.${adventureArea(level)}`) })
  return finishedAdventure > 0 ? `${t('saves.cycle', { n: finishedAdventure + 1 })} · ${stage}` : stage
})

// ---- 保存 ----
const deleteAdventureSave = ref(true)
const askDeleteAdventureSave = computed(() => editor.levelChanged.value && editor.adventureSaveFiles.value.length > 0)

async function save() {
  const error = await editor.save({ deleteAdventureSave: askDeleteAdventureSave.value && deleteAdventureSave.value })
  if (error) toast.error(error)
  else toast.success(t('editor.saved'))
}

// ---- 有未保存的修改时离开要确认 ----
const leaveOpen = ref(false)
let pendingLeave: RouteLocationRaw | null = null

function guard(to: RouteLocationRaw): boolean {
  if (!editor.dirty.value) return true
  pendingLeave = to
  leaveOpen.value = true
  return false
}

onBeforeRouteLeave(to => guard(to.fullPath))
// 同一页面换到另一个用户时也要确认；只换分类不影响草稿
onBeforeRouteUpdate(to => (to.params.id === route.params.id ? true : guard(to.fullPath)))
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (editor.dirty.value) event.preventDefault()
})

function leaveAnyway() {
  editor.discard()
  leaveOpen.value = false
  if (pendingLeave) void router.push(pendingLeave)
  pendingLeave = null
}

function back() {
  void router.push({ name: 'saves' })
}
</script>

<template>
  <PageScroll>
    <!-- 返回行与下面的 SettingsShell 同宽同内边距；返回键左内边距收小，让箭头和标题文字对齐 -->
    <div class="mx-auto w-full max-w-3xl px-4 pt-4 md:px-6 md:pt-6">
      <BackButton
        :label="t('saves.detail.back')"
        class="pl-1"
        @click="back"
      />
    </div>

    <template v-if="loaded">
      <SettingsShell
        v-if="!profile"
        width="narrow"
      >
        <Empty class="border">
          <EmptyHeader>
            <EmptyTitle>{{ t('saves.detail.notFoundTitle') }}</EmptyTitle>
            <EmptyDescription>{{ t('saves.detail.notFoundDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SettingsShell>

      <SettingsShell
        v-else
        width="narrow"
      >
        <PageHeader
          :title="profile.name"
          :description="description"
          :level="1"
          framed
        >
          <template #actions>
            <div class="flex items-center gap-2">
              <ProfileMenu
                :profile="profile"
                trigger="button"
              />
              <!-- 游戏运行中时换成“停止游戏”，停止前确认（与游戏页一致） -->
              <Button
                v-if="session.isActive.value"
                variant="secondary"
                size="sm"
                @click="stopOpen = true"
              >
                <Square />
                {{ t('game.stop') }}
              </Button>
              <Button
                v-else
                size="sm"
                @click="playAs(profile.name)"
              >
                <Play />
                {{ t('saves.play') }}
              </Button>
            </div>
          </template>
        </PageHeader>

        <ProfileSectionNav
          class="mb-6 lg:hidden"
          orientation="horizontal"
          :sections="PROFILE_SECTIONS"
          :active="section"
          @select="selectSection"
        />

        <div class="flex items-start gap-10">
          <div class="min-w-0 flex-1">
            <CalloutBanner
              v-if="editor.readonly.value && section !== 'backup'"
              class="mb-6"
              tone="warning"
              :description="t('editor.readonly')"
            />

            <Transition
              name="section-fade"
              mode="out-in"
            >
              <BackupSection
                v-if="section === 'backup'"
                key="backup"
                :local-id="profile.id"
              />
              <Empty
                v-else-if="!data"
                :key="`empty-${section}`"
                class="border"
              >
                <EmptyHeader>
                  <EmptyTitle>{{ editor.unreadable.value ? t('saves.unreadable') : t('saves.noProgress') }}</EmptyTitle>
                  <EmptyDescription>{{ t('editor.noData') }}</EmptyDescription>
                </EmptyHeader>
              </Empty>
              <OverviewSection
                v-else-if="section === 'overview'"
                key="overview"
                :profile="profile"
                :data="data"
              />
              <AdventureSection
                v-else-if="section === 'adventure'"
                key="adventure"
                :data="data"
              />
              <ChallengesSection
                v-else-if="section === 'challenges'"
                key="challenges"
                :data="data"
              />
              <AlmanacSection
                v-else-if="section === 'almanac'"
                key="almanac"
                :data="data"
                @navigate="selectSection"
              />
              <ShopSection
                v-else-if="section === 'shop'"
                key="shop"
                :data="data"
              />
              <GardenSection
                v-else-if="section === 'garden'"
                key="garden"
                :data="data"
              />
            </Transition>

            <!-- 保存栏：有修改时浮在内容底部 -->
            <Transition name="section-fade">
              <div
                v-if="editor.dirty.value"
                class="sticky bottom-16 z-10 mt-6 flex flex-wrap items-center gap-3 rounded-xl border bg-popover px-4 py-3 shadow-[var(--shadow-dropdown)]"
              >
                <p class="min-w-0 flex-1 text-body text-foreground">
                  {{ t('editor.unsaved') }}
                </p>
                <label
                  v-if="askDeleteAdventureSave"
                  class="flex items-center gap-2 text-body text-muted-foreground"
                >
                  <Checkbox v-model="deleteAdventureSave" />
                  {{ t('editor.deleteAdventureSave') }}
                </label>
                <div class="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    :disabled="editor.saving.value"
                    @click="editor.discard()"
                  >
                    {{ t('editor.discard') }}
                  </Button>
                  <Button
                    size="sm"
                    :loading="editor.saving.value"
                    :disabled="editor.readonly.value"
                    @click="save"
                  >
                    {{ t('saves.save') }}
                  </Button>
                </div>
              </div>
            </Transition>
          </div>

          <aside class="sticky top-6 hidden w-36 shrink-0 lg:block">
            <ProfileSectionNav
              orientation="vertical"
              :sections="PROFILE_SECTIONS"
              :active="section"
              @select="selectSection"
            />
          </aside>
        </div>
      </SettingsShell>
    </template>

    <ConfirmDialog
      v-model:open="stopOpen"
      :title="t('game.stopConfirmTitle')"
      :description="t('game.stopConfirmMessage')"
      :confirm-label="t('game.stop')"
      :cancel-label="t('game.cancel')"
      destructive
      @confirm="stopGame"
    />

    <ConfirmDeleteDialog
      v-model:open="leaveOpen"
      :title="t('editor.leaveTitle')"
      :description="t('editor.leaveDescription')"
      :cancel-label="t('editor.stay')"
      :confirm-label="t('editor.leave')"
      @confirm="leaveAnyway"
    />
  </PageScroll>
</template>
