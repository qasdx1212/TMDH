export type Zone = 'a' | 'b' | 'c'
export type ContentType = 'text' | 'image'

export interface CellData {
  id: number
  col: number
  row: number
  zone: Zone
  taken: boolean
  contentType: ContentType
  contentText: string
  textColor: string
  fontSize: number
  imageData: string | null
  imageBgSize?: string   // 'cover' | '{w}px {h}px'
  imageBgPos?: string    // 'center' | '{x}px {y}px'
  isPermanent: boolean
  expiresAt: Date | null
}

export type LayoutMode = 'perCell' | 'block'

export interface DraftCellInfo {
  contentType: ContentType
  contentText: string
  textColor: string
  fontSize: number
  imageData: string | null
  imageBgSize?: string
  imageBgPos?: string
}

export interface Draft {
  id: string
  cellMap: Map<number, DraftCellInfo>
}

export interface PreviewConfig {
  contentType: ContentType
  text: string
  textColor: string
  fontSize: number
  imageData: string | null
  layoutMode: LayoutMode
  selectionMinCol: number
  selectionMaxCol: number
}
