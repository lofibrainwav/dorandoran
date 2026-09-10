# Apple Photos → Drive handoff

도란도란의 공개 production 화면은 Mac의 Photos 데이터베이스를 직접 읽지 않습니다. iPhone
단축어가 허용한 사진의 메타데이터만 JSON으로 만들어 Google Drive에 올리고, production은
지정한 파일 하나를 읽기 전용으로 투영합니다.

## Drive 파일 계약

파일 본문은 다음 형태입니다.

```json
{
  "version": 1,
  "generatedAt": "2026-09-10T12:00:00.000Z",
  "photos": [
    {
      "id": "shortcut-stable-photo-id",
      "capturedAt": "2026-09-09T12:00:00.000Z",
      "latitude": 37.5665,
      "longitude": 126.978
    }
  ]
}
```

`id`와 `capturedAt`은 필수이며 좌표는 선택입니다. 단축어는 원본 사진·제목·얼굴·파일
본문을 업로드하지 않습니다. 최대 500개 메타데이터 행과 512KiB만 허용합니다.

## 연결 순서

1. iPhone 단축어에서 허용할 사진을 고릅니다.
2. 각 사진의 식별자, 촬영 시각, 위치 좌표만 위 JSON으로 만듭니다.
3. Google Drive의 제한된 가족 폴더에 같은 파일을 갱신합니다.
4. 해당 Drive 파일 ID를 `APPLE_PHOTOS_DRIVE_FILE_ID` production 설정에 넣습니다.
5. 다음 production 배포 후 `/family`의 Google & Apple 상태에서 handoff 상태를 확인합니다.

파일이 없거나 오래되었거나 형식이 잘못되면 지도에 좌표를 표시하지 않습니다. 사진이 0건인
유효 snapshot은 연결된 빈 앨범으로 표시합니다.

## 권한 경계

- Drive OAuth는 기존 읽기 전용 정본을 재사용합니다.
- 도란도란은 Drive 파일을 쓰거나 삭제하지 않습니다.
- 원본 사진은 읽지 않고 메타데이터만 읽습니다.
- 지도에는 cluster 좌표와 집계만 표시하며 내부 사진 ID와 evidence ref는 표시하지 않습니다.
