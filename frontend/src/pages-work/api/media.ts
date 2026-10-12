import { upload } from '../http/upload'
import { parseMediaUpload } from '@/http/validators'

export const mediaApi = {
  upload: (path: string, onProgress: (progress: number) => void) => upload('/media', path, onProgress).then(parseMediaUpload),
}
