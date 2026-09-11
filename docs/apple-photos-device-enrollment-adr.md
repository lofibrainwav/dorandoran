# ADR: Apple Photos 네이티브 기기 등록

**상태:** Accepted
**결정일:** 2026-09-10
**범위:** PhotoKit 메타데이터 전송용 iPhone 동반 앱 인증

## 문맥

DoranDoran의 웹은 `HttpOnly` Google 가족 세션 쿠키를 사용합니다. iPhone의 PhotoKit 백그라운드 동기화는 브라우저 same-origin 요청이 아니므로 웹 쿠키를 재사용할 수 없습니다. 사진 원본은 전송하지 않고 메타데이터만 보내야 하며, 가족 성인이 기기별로 권한을 폐기할 수 있어야 합니다.

## 결정

인증된 성인이 `/family`에서 60초 유효·1회 사용 QR 페어링 코드를 발급합니다. iPhone 동반 앱은 코드를 claim하여 기기 전용 bearer 토큰을 한 번 발급받고, 이후 `Authorization: Bearer`로 메타데이터 delta를 전송합니다.

```text
웹 가족 세션
  -> POST /api/photos/apple/devices/pairing
  -> 60초 QR 코드
  -> POST /api/photos/apple/devices/claim
  -> 기기 전용 토큰 (iPhone Keychain 보관)
  -> POST /api/photos/apple/metadata
  -> metadata-only PhotoKit projection
```

DB에는 pairing code와 device token 원문을 저장하지 않고 HMAC-SHA256 해시만 저장합니다. pairing 소비는 만료·미소비 조건을 포함한 원자적 `UPDATE`로 수행합니다. 기기는 `revoked_at`을 통해 즉시 폐기합니다.

## 선택지

### 웹 쿠키 재사용

거부합니다. HttpOnly 쿠키를 앱으로 복사하거나 장기 저장하면 브라우저 세션과 네이티브 권한이 섞이고 기기별 폐기가 불가능합니다.

### 네이티브 Google OAuth 직접 구현

향후 선택지입니다. 장기적으로는 표준 OAuth 앱 등록과 refresh token 회전이 가능하지만, 현재 Google 가족 세션과 별도의 클라이언트 등록·심사·토큰 수명 정책이 필요합니다.

### QR 일회용 페어링

현재 채택합니다. 가족 성인의 명시적 승인과 기기별 폐기를 제공하면서, iOS 앱의 초기 구현 범위를 작게 유지합니다. QR 원문은 60초 뒤 또는 첫 claim 뒤 무효입니다.

## 보안·운영 결과

- 네이티브 ingest는 등록된 `device_id`, `library_scope`, 폐기 상태, HMAC 토큰을 모두 검증합니다.
- 기존 웹 ingest는 계속 same-origin과 가족 세션을 요구합니다.
- 원본 사진·썸네일·raw EXIF는 API와 DB 계약에 포함되지 않습니다.
- 토큰 분실 시 웹에서 기기 ID를 폐기하고 새 QR로 재등록합니다.
- 기기 마지막 접속 시각은 `last_seen_at`으로 관찰합니다.

## 후속 작업

- [ ] iOS PhotoKit 동반 앱 골격과 Keychain 저장
- [ ] `/family`에 QR 발급·연결 기기·폐기 UI 추가
- [ ] 실제 iPhone에서 백그라운드 변경 관찰과 cursor 재개 검증
- [ ] 필요 시 `DORANDORAN_DEVICE_AUTH_SECRET`를 기존 인증 비밀과 분리

