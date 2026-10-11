<script setup lang="ts">
// 游戏内用户的操作菜单（卡片与详情页共用）：重命名、复制、导出、删除
import {
  Button,
  CalloutBanner,
  ConfirmDeleteDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FieldStack,
  FormDialogShell,
  Input,
} from '@felinic/ui'
import { MAX_PROFILE_NAME_LENGTH } from '@shared/pvz/profiles'
import { Copy, Download, Ellipsis, Pencil, Trash2 } from 'lucide-vue-next'
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameSession } from '@/composables/useGameSession'
import { type ProfileRef, useProfileActions } from '@/composables/useProfileActions'

const props = withDefaults(defineProps<{
  profile: ProfileRef
  /** 触发按钮：卡片里用图标，详情页用带文字的次要按钮 */
  trigger?: 'icon' | 'button'
}>(), {
  trigger: 'icon',
})

const emit = defineEmits<{
  deleted: []
}>()

const { t } = useI18n()
const session = useGameSession()
const actions = useProfileActions()

const renameOpen = ref(false)
const renameValue = ref('')
const renameError = ref<string | null>(null)
const deleteOpen = ref(false)

// 从菜单里打开对话框要等菜单关闭，否则焦点会被菜单收回
function openRename() {
  renameValue.value = props.profile.name
  renameError.value = null
  void nextTick(() => (renameOpen.value = true))
}

function openDelete() {
  void nextTick(() => (deleteOpen.value = true))
}

async function submitRename() {
  if (renameValue.value.trim() === props.profile.name) {
    renameOpen.value = false
    return
  }
  renameError.value = await actions.rename(props.profile, renameValue.value)
  if (!renameError.value) renameOpen.value = false
}

async function confirmDelete() {
  if (await actions.remove(props.profile)) {
    deleteOpen.value = false
    emit('deleted')
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        v-if="trigger === 'icon'"
        variant="ghost"
        size="icon-sm"
        tone="muted"
        :aria-label="t('saves.more')"
      >
        <Ellipsis />
      </Button>
      <Button
        v-else
        variant="secondary"
        size="sm"
      >
        <Ellipsis />
        {{ t('saves.more') }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <template v-if="session.isActive.value">
        <DropdownMenuLabel>{{ t('saves.runningHint') }}</DropdownMenuLabel>
        <DropdownMenuSeparator />
      </template>
      <DropdownMenuItem
        :disabled="session.isActive.value"
        @select="openRename"
      >
        <Pencil />
        {{ t('saves.rename') }}
      </DropdownMenuItem>
      <DropdownMenuItem
        :disabled="session.isActive.value"
        @select="actions.duplicate(profile)"
      >
        <Copy />
        {{ t('saves.duplicate') }}
      </DropdownMenuItem>
      <DropdownMenuItem @select="actions.exportZip(profile)">
        <Download />
        {{ t('saves.export') }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        :disabled="session.isActive.value"
        @select="openDelete"
      >
        <Trash2 />
        {{ t('saves.delete') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <FormDialogShell
    v-model:open="renameOpen"
    :title="t('saves.renameTitle')"
    :cancel-text="t('saves.cancel')"
    :submit-text="t('saves.save')"
    :loading="actions.busy.value"
    @submit="submitRename"
  >
    <template #body>
      <div class="space-y-3 pt-4">
        <FieldStack
          :label="t('saves.renameLabel')"
          :help="t('saves.renameHint')"
          for="profile-rename"
        >
          <Input
            id="profile-rename"
            v-model="renameValue"
            :maxlength="MAX_PROFILE_NAME_LENGTH"
            autocomplete="off"
          />
        </FieldStack>
        <CalloutBanner
          v-if="renameError"
          tone="destructive"
          size="sm"
          :description="renameError"
        />
      </div>
    </template>
  </FormDialogShell>

  <ConfirmDeleteDialog
    v-model:open="deleteOpen"
    :title="t('saves.deleteTitle', { name: profile.name })"
    :description="t('saves.deleteDescription')"
    :cancel-label="t('saves.cancel')"
    :confirm-label="t('saves.delete')"
    :loading="actions.busy.value"
    @confirm="confirmDelete"
  />
</template>
