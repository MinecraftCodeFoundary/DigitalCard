export async function chooseAvatar(): Promise<string> {
  const result = await uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
  })
  const path = result.tempFilePaths[0]
  let data = ''
  // #ifdef H5
  const blob = await (await fetch(path)).blob()
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
  data = await new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('图片处理失败'))
        return
      }
      const side = Math.min(image.width, image.height)
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      )
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = source
  })
  // #endif
  // #ifdef MP-WEIXIN
  const compressed = await uni.compressImage({
    src: path,
    quality: 70,
    compressedWidth: 256,
    compressedHeight: 256,
  })
  data = await new Promise<string>((resolve, reject) => {
    uni
      .getFileSystemManager()
      .readFile({
        filePath: compressed.tempFilePath,
        encoding: 'base64',
        success: result => resolve(`data:image/jpeg;base64,${result.data}`),
        fail: () => reject(new Error('图片读取失败')),
      })
  })
  // #endif
  if (!data || data.length > 150000)
    throw new Error('图片过大，请选择更小的头像')
  return data
}
