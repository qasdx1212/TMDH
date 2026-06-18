export type Zone = 'neon' | 'riverside' | 'oldtown' | 'artdistrict'
export type HouseStatus = 'available' | 'pending' | 'occupied'
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled'
export type BorderEffect = 'none' | 'neon'

export interface House {
  id: string
  address: string
  col: number
  row: number
  width: number
  height: number
  zone: Zone
  user_id: string | null
  nickname: string | null
  name: string | null
  description: string | null
  link_url: string | null
  exterior_image_url: string | null
  interior_image_url: string | null
  border_effect: BorderEffect
  status: HouseStatus
  occupied_at: string | null
  expires_at: string | null
  is_permanent: boolean
  like_count: number
  visit_count: number
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  user_id: string
  house_id: string
  amount: number
  days: number | null
  status: OrderStatus
  payment_key: string | null
  created_at: string
  paid_at: string | null
}

export interface Like {
  id: string
  user_id: string
  house_id: string
  created_at: string
}

export interface Visit {
  id: string
  house_id: string
  visitor_ip: string | null
  visited_at: string
}

export interface Database {
  public: {
    Tables: {
      houses: {
        Row: House
        Insert: Omit<House, 'id' | 'created_at' | 'updated_at' | 'like_count' | 'visit_count'>
        Update: Partial<Omit<House, 'id' | 'created_at'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'created_at'>
        Update: Partial<Omit<Order, 'id' | 'created_at'>>
      }
      likes: {
        Row: Like
        Insert: Omit<Like, 'id' | 'created_at'>
        Update: never
      }
      visits: {
        Row: Visit
        Insert: Omit<Visit, 'id'>
        Update: never
      }
    }
  }
}
