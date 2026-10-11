// 单个游戏内用户的管理：重命名 / 复制 / 删除 / 导出。
// 改动直接写进本地 IndexedDB（只能在游戏未运行时），再立即同步到云端。
// 动手前先与云端对齐，避免在过期的存档上修改造成冲突。

import { toast } from '@felinic/ui'
import { type ArchiveFiles, packZip } from '@shared/pvz/archive'
import { renameCurrentUser } from '@shared/pvz/game-config'
import type { ImportCandidate } from '@shared/pvz/import'
import { addProfile, deleteProfile, duplicateProfile, exportProfile, MAX_PROFILES, listProfiles, ProfileOperationError, renameProfile } from '@shared/pvz/profiles'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { readSaveFiles, replaceArchiveFiles, toArchiveFiles, updateSaveFile } from '@/lib/idbfs'
import { useCloudSync } from './useCloudSync'
import { useGameSession } from './useGameSession'
import { useGameSettings } from './useGameSettings'
import { refreshLocalSaves } from './useLocalSaves'

export interface ProfileRef {
  id: number
  name: string
}

export function useProfileActions() {
  const { t } = useI18n()
  const session = useGameSession()
  const sync = useCloudSync()
  const settings = useGameSettings()
  const busy = ref(false)

  /** 返回错误文案；成功返回 null */
  async function mutate(change: (files: ArchiveFiles) => ArchiveFiles): Promise<string | null> {
    if (session.isActive.value) return t('saves.stopGameFirst')
    busy.value = true
    try {
      if (!(await sync.prepareLaunch())) return t('saves.syncFirst')
      const files = toArchiveFiles(await readSaveFiles())
      await replaceArchiveFiles(change(files))
      await refreshLocalSaves()
      void sync.syncNow()
      return null
    }
    catch (error) {
      if (error instanceof ProfileOperationError) return t(`saves.errors.${error.code}`)
      throw error
    }
    finally {
      busy.value = false
    }
  }

  async function rename(profile: ProfileRef, name: string): Promise<string | null> {
    const error = await mutate(files => renameProfile(files, profile.id, name))
    if (error) return error
    const newName = name.trim()
    // 游戏记录的“上次使用的用户”和外层的启动用户都跟着改名
    await updateSaveFile('registry.regemu', bytes => renameCurrentUser(bytes, profile.name, newName))
    if (settings.value.launchUser === profile.name) settings.value.launchUser = newName
    toast.success(t('saves.renamed', { name: newName }))
    return null
  }

  async function duplicate(profile: ProfileRef) {
    let copied = ''
    const error = await mutate((files) => {
      const result = duplicateProfile(files, profile.id)
      copied = result.name
      return result.files
    })
    if (error) toast.error(error)
    else toast.success(t('saves.duplicated', { name: copied }))
  }

  async function remove(profile: ProfileRef): Promise<boolean> {
    const error = await mutate(files => deleteProfile(files, profile.id))
    if (error) {
      toast.error(error)
      return false
    }
    if (settings.value.launchUser === profile.name) settings.value.launchUser = null
    toast.success(t('saves.deleted', { name: profile.name }))
    return true
  }

  /** 导出为 zip：解压后的 userdata/ 可直接放进游戏的存档目录 */
  async function exportZip(profile: ProfileRef) {
    const files = toArchiveFiles(await readSaveFiles())
    try {
      const zip = packZip(exportProfile(files, profile.id))
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `pvz-${profile.name}.zip`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(t('saves.exported', { name: profile.name }))
    }
    catch (error) {
      if (error instanceof ProfileOperationError) toast.error(t(`saves.errors.${error.code}`))
      else throw error
    }
  }

  /** 导入选中的用户：都作为新用户加入，重名时自动改用副本名。返回错误文案，成功返回 null */
  async function importProfiles(candidates: ImportCandidate[]): Promise<string | null> {
    const added: string[] = []
    const error = await mutate((files) => {
      let next = files
      if (listProfiles(next).length + candidates.length > MAX_PROFILES) throw new ProfileOperationError('too-many')
      for (const candidate of candidates) {
        const result = addProfile(next, candidate.profile)
        next = result.files
        added.push(result.name)
      }
      return next
    })
    if (!error) toast.success(t('saves.import.done', { count: added.length, names: added.join('、') }))
    return error
  }

  return { busy, rename, duplicate, remove, exportZip, importProfiles }
}
