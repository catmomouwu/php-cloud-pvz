// LawnStrings.txt：[KEY] 后面到下一个 [ 之前是值（去首尾空白、删 \r）。
// 描述里的 {TOKEN} 切换样式并一直持续到下一个标记：
//   {KEYWORD} 属性名、{STAT} 属性值、{FLAVOR} 风味文字（换行当空格）、{SHORTLINE} 窄空行、
//   {NOCTURNAL} / {AQUATIC} 特性提示、{METAL} / {KEYMETAL} 金属相关、{270} 这类数字是隐藏的耐久值。

export function parseStrings(source: string): Map<string, string> {
  const strings = new Map<string, string>()
  for (const match of source.matchAll(/\[([^\]]+)\]([^[]*)/g)) {
    strings.set(match[1]!.trim().toUpperCase(), match[2]!.replace(/\r/g, '').trim())
  }
  return strings
}

export interface DescriptionAttribute {
  label: string
  value: string
  /** 隐藏的耐久等数值 */
  number?: string
}

export interface Description {
  intro: string[]
  /** 夜行、水生等特性提示 */
  traits: string[]
  attributes: DescriptionAttribute[]
  flavor: string
}

const TOKEN = /\{([A-Z0-9]+)\}/g

export function parseDescription(text: string): Description {
  const result: Description = { intro: [], traits: [], attributes: [], flavor: '' }
  let style = ''
  const flavor: string[] = []

  for (const line of text.split('\n')) {
    // 按标记切成若干段，记录每段的样式
    const segments: { style: string, text: string }[] = []
    const numbers: string[] = []
    let cursor = 0
    for (const match of line.matchAll(TOKEN)) {
      const before = line.slice(cursor, match.index)
      if (before) segments.push({ style, text: before })
      const token = match[1]!
      if (/^\d+$/.test(token)) numbers.push(token)
      else if (token !== 'SHORTLINE') style = token
      cursor = match.index! + match[0].length
    }
    const rest = line.slice(cursor)
    if (rest) segments.push({ style, text: rest })

    const plain = segments.map(segment => segment.text).join('').trim()
    if (!plain && numbers.length === 0) continue

    if (segments.some(segment => segment.style === 'KEYWORD' || segment.style === 'KEYMETAL')) {
      const label = segments.filter(s => s.style === 'KEYWORD' || s.style === 'KEYMETAL').map(s => s.text).join('').trim().replace(/[:：]\s*$/, '')
      const value = segments.filter(s => s.style !== 'KEYWORD' && s.style !== 'KEYMETAL').map(s => s.text).join('').trim()
      result.attributes.push({ label, value, number: numbers[0] })
    }
    else if (segments.every(segment => segment.style === 'FLAVOR')) {
      flavor.push(plain)
    }
    else if (segments.every(segment => segment.style === 'NOCTURNAL' || segment.style === 'AQUATIC')) {
      result.traits.push(plain)
    }
    else if (plain) {
      result.intro.push(plain)
    }
  }
  result.flavor = flavor.join(' ')
  return result
}
