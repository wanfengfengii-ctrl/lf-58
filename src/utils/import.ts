import type { AnnotationScheme } from '../types'
import { validateSchemeBounds } from './validation'
import { generateId } from './geometry'

export function parseSchemeJson(jsonString: string): AnnotationScheme | null {
  try {
    const parsed = JSON.parse(jsonString)
    if (
      parsed.id &&
      parsed.researcher !== undefined &&
      parsed.projectName &&
      parsed.image &&
      Array.isArray(parsed.layers) &&
      Array.isArray(parsed.bladePaths)
    ) {
      return parsed as AnnotationScheme
    }
    return null
  } catch {
    return null
  }
}

export async function readJsonFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      resolve(content)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export async function readImageFile(file: File): Promise<{
  url: string
  width: number
  height: number
  name: string
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      const img = new Image()
      img.onload = () => {
        resolve({
          url,
          width: img.width,
          height: img.height,
          name: file.name
        })
      }
      img.onerror = () => reject(new Error('无法加载图像'))
      img.src = url
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function validateAndImportScheme(
  scheme: AnnotationScheme,
  currentImageWidth: number,
  currentImageHeight: number
): {
  success: boolean
  errors: string[]
  scheme?: AnnotationScheme
} {
  const boundsCheck = validateSchemeBounds(scheme, currentImageWidth, currentImageHeight)

  if (!boundsCheck.valid) {
    return {
      success: false,
      errors: [
        `导入方案中存在坐标越界的刀路：${boundsCheck.invalidPaths.join(', ')}，已保留当前标注，未覆盖。`
      ]
    }
  }

  const importedScheme: AnnotationScheme = {
    ...scheme,
    id: generateId(),
    importedAt: Date.now()
  }

  return {
    success: true,
    errors: [],
    scheme: importedScheme
  }
}
