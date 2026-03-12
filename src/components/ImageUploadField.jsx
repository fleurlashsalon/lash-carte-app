import { useMemo, useRef } from 'react'

function createImageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isAllowedType(type) {
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/jpg'
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

const MAX_IMAGE_DIMENSION = 1200
const JPEG_QUALITY = 0.82

/**
 * 画像をリサイズ・JPEG圧縮して dataURL を返す（保存容量の最適化）
 */
function optimizeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
        width = Math.min(width, MAX_IMAGE_DIMENSION)
        height = Math.min(height, MAX_IMAGE_DIMENSION)
      } else {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        const optimized = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        resolve(optimized || dataUrl)
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export default function ImageUploadField({ images = [], onChange }) {
  const inputRef = useRef(null)

  const countText = useMemo(() => {
    if (!images.length) return '未追加'
    return `${images.length}枚`
  }, [images.length])

  async function handlePick(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remaining = Math.max(0, 3 - (images?.length || 0))
    if (remaining <= 0) {
      alert('画像は最大3枚まで追加できます')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    const targetFiles = files.slice(0, remaining)

    const nextItems = []

    for (const file of targetFiles) {
      if (!isAllowedType(file.type)) continue
      const rawDataUrl = await toDataUrl(file)
      const dataUrl = await optimizeImage(rawDataUrl)
      nextItems.push({
        id: createImageId(),
        fileName: file.name,
        type: 'image/jpeg',
        dataUrl,
        uploadedAt: Date.now(),
      })
    }

    if (nextItems.length) {
      onChange?.([...(images || []), ...nextItems])
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  function removeImage(id) {
    onChange?.((images || []).filter((x) => x.id !== id))
  }

  return (
    <div className="imageField">
      <div className="imageFieldTop">
        <div>
          <div className="fieldLabelText">画像</div>
          <div className="fieldHint">jpg / jpeg / png（複数可 / 最大3枚）・{countText}</div>
        </div>
        <div className="imageFieldActions">
          <label className="btn subtle" style={{ minWidth: 140, textAlign: 'center' }}>
            画像を選択
            <input
              ref={inputRef}
              className="hiddenInput"
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              multiple
              onChange={handlePick}
            />
          </label>
        </div>
      </div>

      {images?.length ? (
        <div className="imageGrid">
          {images.map((img) => (
            <div key={img.id} className="imageTile">
              <div className="imagePreview">
                <img src={img.dataUrl} alt={img.fileName || 'upload'} />
              </div>
              <div className="imageMeta">
                <div className="imageName" title={img.fileName}>
                  {img.fileName || 'image'}
                </div>
                <button type="button" className="btn small danger" onClick={() => removeImage(img.id)}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mutedText">画像はまだ追加されていません。</div>
      )}
    </div>
  )
}

