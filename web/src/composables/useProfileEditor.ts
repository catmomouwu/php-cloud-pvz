// 存档编辑器的草稿：各分类页改的都是同一份草稿，底部“保存 / 放弃”统一提交。
// 保存时直接改写本地 IndexedDB 里的 user{id}.dat（游戏未运行时），再同步到云端，生成一条同步记录。
// 草稿基于打开时的文件内容；保存前文件被游戏或云同步改过，就放弃这次保存，避免覆盖别处的进度。

import { clonePlayerData, type PlayerData, parsePlayerData, serializePlayerData } from '@shared/pvz/player-data'
import { userDatPath } from '@shared/pvz/userdata'
import { computed, type InjectionKey, inject, provide, type Ref, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { patchSaveFiles, StaleSaveError } from '@/lib/idbfs'
import { useCloudSync } from './useCloudSync'
import { useGameSession } from './useGameSession'
import { type LocalProfile, refreshLocalSaves } from './useLocalSaves'

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.byteLength === b.byteLength && a.every((value, index) => value === b[index])
}

export interface SaveOptions {
  /** 同时删除冒险模式的中途存档（改了冒险关卡后旧的中途存档对不上） */
  deleteAdventureSave?: boolean
}

/** 冒险模式的中途存档：game{id}_0.v4（GameMode 0 = 冒险） */
const ADVENTURE_SAVE = /\/game\d+_0\.(v4|dat)$/

function createProfileEditor(profile: Ref<LocalProfile | null>) {
  const { t } = useI18n()
  const session = useGameSession()
  const sync = useCloudSync()

  const baseBytes = shallowRef<Uint8Array | null>(null)
  const base = shallowRef<PlayerData | null>(null)
  const draft = ref<PlayerData | null>(null)
  const unreadable = ref(false)
  const saving = ref(false)

  function load(bytes: Uint8Array | null) {
    baseBytes.value = bytes
    unreadable.value = false
    try {
      base.value = bytes ? parsePlayerData(bytes) : null
    }
    catch {
      base.value = null
      unreadable.value = true
    }
    draft.value = base.value ? clonePlayerData(base.value) : null
  }

  const draftBytes = computed(() => (draft.value ? serializePlayerData(draft.value) : null))
  const dirty = computed(() => !!draftBytes.value && !!baseBytes.value && !sameBytes(draftBytes.value, baseBytes.value))
  /** 改了冒险关卡且有冒险中途存档时，保存前要问是否删除 */
  const adventureSaveFiles = computed(() => profile.value?.midLevelFiles.filter(file => ADVENTURE_SAVE.test(file)) ?? [])
  const levelChanged = computed(() => !!draft.value && !!base.value
    && (draft.value.level !== base.value.level || draft.value.finishedAdventure !== base.value.finishedAdventure))

  /** 游戏运行时引擎会用内存里的数据覆盖存档，只能查看 */
  const readonly = computed(() => session.isActive.value)

  // 换用户、或文件被游戏 / 同步更新时重新载入；有未保存的修改时保留草稿，保存时再检查
  watch(() => [profile.value?.id, profile.value?.userDat] as const, ([id, bytes], previous) => {
    if (dirty.value && id === previous?.[0]) return
    load(bytes ?? null)
  }, { immediate: true })

  /** 对草稿做一次修改（快捷操作用） */
  function apply(change: (data: PlayerData) => void) {
    if (draft.value && !readonly.value) change(draft.value)
  }

  function discard() {
    load(baseBytes.value)
  }

  /** 返回错误文案；成功返回 null */
  async function save(options: SaveOptions = {}): Promise<string | null> {
    const current = profile.value
    if (!current || !draft.value || !baseBytes.value || !draftBytes.value) return null
    if (session.isActive.value) return t('saves.stopGameFirst')
    saving.value = true
    try {
      const path = userDatPath(current.id)
      const changes = new Map<string, Uint8Array | null>([[path, draftBytes.value]])
      if (options.deleteAdventureSave) for (const file of adventureSaveFiles.value) changes.set(file, null)
      await patchSaveFiles(changes, new Map([[path, baseBytes.value]]))
      load(draftBytes.value)
      await refreshLocalSaves()
      void sync.syncNow()
      return null
    }
    catch (error) {
      if (error instanceof StaleSaveError) return t('editor.stale')
      throw error
    }
    finally {
      saving.value = false
    }
  }

  return { base, draft, dirty, readonly, unreadable, saving, adventureSaveFiles, levelChanged, apply, discard, save }
}

export type ProfileEditor = ReturnType<typeof createProfileEditor>

const EDITOR_KEY: InjectionKey<ProfileEditor> = Symbol('profile-editor')

export function provideProfileEditor(profile: Ref<LocalProfile | null>): ProfileEditor {
  const editor = createProfileEditor(profile)
  provide(EDITOR_KEY, editor)
  return editor
}

export function useProfileEditor(): ProfileEditor {
  const editor = inject(EDITOR_KEY)
  if (!editor) throw new Error('useProfileEditor() needs provideProfileEditor() in a parent')
  return editor
}
