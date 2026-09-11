'use client'

import { useState } from 'react'

type PairingState = 'idle' | 'loading' | 'ready' | 'error'

export function ApplePhotoPairingPanel({ canPair }: { canPair: boolean }) {
  const [state, setState] = useState<PairingState>('idle')
  const [code, setCode] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [message, setMessage] = useState('')

  async function createPairing() {
    if (!canPair || state === 'loading') return
    setState('loading')
    setMessage('')
    try {
      const response = await fetch('/api/photos/apple/devices/pairing', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = (await response.json()) as { pairingCode?: string; expiresAt?: string; error?: string }
      if (!response.ok || !data.pairingCode || !data.expiresAt) throw new Error(data.error ?? 'PAIRING_FAILED')
      setCode(data.pairingCode)
      setExpiresAt(data.expiresAt)
      setState('ready')
    } catch {
      setState('error')
      setMessage('iPhone 연결 코드를 만들지 못했습니다. 로그인과 연결 상태를 확인해 주세요.')
    }
  }

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setMessage('연결 코드를 복사했습니다.')
    } catch {
      setMessage('복사하지 못했습니다. 코드를 길게 눌러 직접 복사해 주세요.')
    }
  }

  return <div className="apple-pairing-panel">
    <div className="apple-pairing-heading"><strong>iPhone Photos 메타데이터</strong><span>원본 사진은 전송하지 않음</span></div>
    <p>승인된 iPhone이 사진의 시간·위치·종류만 도란도란으로 보냅니다. 성인만 1회용 연결 코드를 만들 수 있습니다.</p>
    <button type="button" className="export-button" onClick={() => void createPairing()} disabled={!canPair || state === 'loading'}>
      {state === 'loading' ? '코드 만드는 중…' : 'iPhone 연결 코드 만들기'}
    </button>
    {!canPair ? <small>성인 가족 계정으로 로그인하면 연결할 수 있습니다.</small> : null}
    {state === 'ready' ? <div className="apple-pairing-code" aria-live="polite"><code>{code}</code><button type="button" onClick={() => void copyCode()}>복사</button><small>한 번만 사용 · {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 만료</small></div> : null}
    {message ? <small role="status">{message}</small> : null}
  </div>
}

