export type CardTheme = 'forest' | 'sand' | 'ink'
export type CardTemplate
  = 'signature' | 'festive' | 'business' | 'neon' | 'floral' | 'poster'
    | 'obsidian' | 'porcelain' | 'editorial' | 'sunset' | 'aurora' | 'botanical'
export type CardDisplayField = 'title' | 'company' | 'location' | 'tags'
export type CardPageIcon = 'user' | 'company' | 'product' | 'contact' | 'image' | 'video' | 'link'
export interface CardPage {
  id: string
  title: string
  columns: 1 | 2
  icon?: CardPageIcon
  presentation?: 'cards' | 'article'
}
export interface CardContentFields {
  id: string
  title: string
  content: string
  visible: boolean
  showTitle?: boolean
  pageId?: string
  columnSpan?: 1 | 2
  images?: string[]
  url?: string
  poster?: string
  imageLayout?: 'grid' | 'stack'
  buttonLabel?: string
}
export interface CardContentBlock extends CardContentFields {
  type: 'text' | 'image' | 'video' | 'link'
}
export interface CardSection extends CardContentFields {
  type: 'about' | 'contact' | 'text' | 'image' | 'video' | 'link' | 'card'
  blocks?: CardContentBlock[]
  cardLayout?: 'stack' | 'columns' | 'showcase'
}
export interface CardAppearance {
  template?: CardTemplate
  layout: 'classic' | 'centered' | 'minimal' | 'portrait' | 'poster'
  coverImage?: string
  brandLogo?: string
  posterPortraitScale?: number
  posterPortraitX?: number
  posterFooter?: string
  accentColor: string
  coverLabel: string
  coverTitle: string
  wordmark: string
  avatarShape: 'rounded' | 'circle' | 'square'
  decoration: boolean
  hiddenFields: CardDisplayField[]
}
export interface CardBody {
  name: string
  title: string
  company: string
  phone: string
  email: string
  wechat: string
  location: string
  bio: string
  avatar: string
  website: string
  tags: string[]
  theme: CardTheme
  published: boolean
  appearance?: CardAppearance
  sections?: CardSection[]
  pages?: CardPage[]
}
export interface Card extends CardBody {
  id: string
  isVip?: boolean
  updatedAt: string
  isOwner?: boolean
  isFavorite?: boolean
  savedAt?: string
  mediaAccess?: Record<string, string>
  mediaUnavailable?: boolean
}
export interface MediaUpload {
  url: string
  previewUrl?: string
  mediaUnavailable?: boolean
  kind: 'image' | 'video'
  size: number
}
export interface CardList {
  items: Card[]
  total: number
  page: number
  pageSize: number
  unavailableIds?: string[]
}
export interface CardMessageBody {
  name: string
  contact: string
  content: string
}
export interface CardMessage extends CardMessageBody {
  id: string
  createdAt: string
}
export interface MessageList {
  items: CardMessage[]
  total: number
  page: number
  pageSize: number
}
export interface Stats {
  views: number
  todayViews: number
  favorites: number
  contacts: number
  days: { day: string, views: number }[]
}
export interface Membership {
  plan: 'free' | 'vip'
  expiresAt: string | null
  isVip: boolean
}
export interface AccountProfile {
  id: string
  mode: 'demo' | 'wechat'
  createdAt: string
  membership: Membership
}
export interface LoginResponse {
  token: string
  expiresIn: number
  devKey?: string
  card: Card
  mode: 'demo' | 'wechat'
  account?: AccountProfile
}
export interface QrResponse {
  image: string
  url: string
  mode: 'web' | 'wechat'
}
