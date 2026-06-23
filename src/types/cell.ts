export type Zone = 'neon' | 'riverside' | 'oldtown' | 'artdistrict'
export type HouseStatus = 'available' | 'pending' | 'occupied'

export interface CellData {
  id: string
  address: string
  col: number
  row: number
  width?: number
  height?: number
  zone: Zone
  status: HouseStatus
  name: string | null
  nickname: string | null
  description: string | null
  link_url: string | null
  exterior_image_url: string | null
  interior_image_url?: string | null
  border_effect: 'none' | 'neon'
  like_count: number
  visit_count: number
  occupied_at: string | null
  expires_at: string | null
  is_permanent: boolean
  parent_address?: string | null
  is_visible?: boolean
}
