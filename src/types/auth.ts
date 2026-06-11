/**
 * Authentication type definitions
 */

export interface User {
  id: string
  email: string
  role: 'CEO' | 'EMPLOYEE'
  full_name?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  full_name: string
  role: 'CEO' | 'EMPLOYEE'
}

export interface AuthResponse {
  success: boolean
  message?: string
  user: User
  access_token: string
  token_type: string
}

export interface LogoutResponse {
  success: boolean
  message: string
}

export interface CurrentUserResponse {
  id: string
  email: string
  role: string
  full_name?: string
}

