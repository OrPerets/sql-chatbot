import { NextResponse } from 'next/server'

export type InsufficientCoinsResponseBody = {
  error: 'INSUFFICIENT_COINS'
  message: 'Not enough coins'
  balance: number
  required: number
}

export function insufficientCoinsResponse(balance: number, required: number) {
  const body: InsufficientCoinsResponseBody = {
    error: 'INSUFFICIENT_COINS',
    message: 'Not enough coins',
    balance,
    required,
  }

  return NextResponse.json(body, { status: 402 })
}
