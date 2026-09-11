import Photos
import SwiftUI

private actor UserDefaultsCursorStore: ApplePhotoCursorStore {
    private let key = "dorandoran.apple-photo.server-cursor"

    func read() async throws -> String? { UserDefaults.standard.string(forKey: key) }

    func write(_ cursor: String) async throws {
        UserDefaults.standard.set(cursor, forKey: key)
    }
}

@main
struct DoranDoranPhotosCompanionApp: App {
    @StateObject private var model = CompanionModel()

    var body: some Scene {
        WindowGroup {
            CompanionView(model: model)
                .onOpenURL { url in
                    model.handlePairingURL(url)
                }
        }
    }
}

@MainActor
final class CompanionModel: ObservableObject {
    @Published var pairingCode = ""
    @Published var deviceName = "iPhone Photos"
    @Published var status = "도란도란과 연결할 준비가 됐습니다."
    @Published var connected = false
    @Published var photoPermission = PHPhotoLibrary.authorizationStatus(for: .readWrite)

    private let tokenStore = ApplePhotoKeychainTokenStore()
    private let cursorStore = UserDefaultsCursorStore()
    private var stream: PhotoKitMetadataChangeStream?
    private var client: ApplePhotoCompanionClient?
    private var deviceId: String?

    func requestPhotoAccess() {
        Task {
            let access = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
            photoPermission = access
            status = access == .authorized || access == .limited ? "사진 메타데이터 읽기 권한이 허용됐습니다." : "사진 메타데이터 읽기 권한이 필요합니다."
            if access == .authorized || access == .limited, let deviceId, let client {
                startStream(deviceId: deviceId, client: client)
            }
        }
    }

    func claim() {
        let code = pairingCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { status = "웹에서 만든 연결 코드를 입력해 주세요."; return }
        status = "연결 코드를 확인하는 중…"
        Task {
            do {
                let pairing = try ApplePhotoPairingClient(baseURL: URL(string: "https://dorandoran.link")!)
                let registration = try await pairing.claimAndStore(pairingCode: code, deviceName: deviceName, tokenStore: tokenStore)
                UserDefaults.standard.set(registration.deviceId, forKey: "dorandoran.apple.device-id")
                let ingestClient = try ApplePhotoCompanionClient(baseURL: URL(string: "https://dorandoran.link")!, tokenStore: tokenStore)
                client = ingestClient
                deviceId = registration.deviceId
                connected = true
                pairingCode = ""
                status = "연결됐습니다. 사진 원본 없이 메타데이터만 동기화합니다."
                startStream(deviceId: registration.deviceId, client: ingestClient)
            } catch {
                connected = false
                status = "연결하지 못했습니다. 코드가 만료됐거나 이미 사용됐을 수 있습니다."
            }
        }
    }

    func handlePairingURL(_ url: URL) {
        guard url.scheme == "dorandoran",
              (url.host == "pair" || url.path == "/pair"),
              let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value,
              !code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            status = "도란도란 연결 링크가 올바르지 않습니다."
            return
        }
        pairingCode = code
        claim()
    }

    private func startStream(deviceId: String, client: ApplePhotoCompanionClient) {
        guard photoPermission == .authorized || photoPermission == .limited else { return }
        stream?.stop()
        let nextStream = PhotoKitMetadataChangeStream { [weak self] operations in
            Task { @MainActor in
                await self?.send(operations, deviceId: deviceId, client: client)
            }
        }
        stream = nextStream
        nextStream.start()
        let initial = PhotoKitMetadataCollector.collect().map(ApplePhotoOperation.upsert)
        if !initial.isEmpty {
            Task { @MainActor in await send(initial, deviceId: deviceId, client: client) }
        }
    }

    private func send(_ operations: [ApplePhotoOperation], deviceId: String, client: ApplePhotoCompanionClient) async {
        do {
            let cursor = (try? await cursorStore.read()) ?? "initial"
            let batch = ApplePhotoMetadataBatch(deviceId: deviceId, cursor: "\(cursor)-\(UUID().uuidString)", events: operations)
            let receipt = try await client.ingest(batch)
            try await cursorStore.write(receipt.cursor)
            status = "동기화됨 · metadata \(receipt.eventCount)건"
        } catch {
            status = "동기화 대기 중입니다. 연결 상태를 확인해 주세요."
        }
    }
}

struct CompanionView: View {
    @ObservedObject var model: CompanionModel
    @StateObject private var eventKit = AppleEventKitBridge()
    @StateObject private var homeKit = AppleHomeKitBridge()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            Form {
                Section("사진 권한") {
                    Text(permissionLabel)
                    Button("PhotoKit 읽기 권한 요청") { model.requestPhotoAccess() }
                }
                Section("도란도란 연결") {
                    TextField("웹에서 만든 1회용 코드", text: $model.pairingCode)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("기기 이름", text: $model.deviceName)
                    Button(model.connected ? "연결됨" : "연결 코드 사용") { model.claim() }
                        .disabled(model.connected || model.pairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Section("Apple Digital Atoms") {
                    Text(eventKit.calendarStatus)
                    Text(eventKit.remindersStatus)
                    Text(eventKit.metadataStatus)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("Calendar · Reminders 권한 요청") {
                        Task { await eventKit.requestAccess() }
                    }
                    Button("Calendar · Reminders 메타데이터 동기화") {
                        Task { await eventKit.syncMetadataWindow() }
                    }
                    Text(homeKit.status)
                    Button("HomeKit 메타데이터 동기화") {
                        Task { @MainActor in await homeKit.syncMetadata() }
                    }
                }
                Section("상태") {
                    Text(model.status)
                    Text("사진 원본·썸네일·raw EXIF는 전송하지 않습니다.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("도란도란 Photos")
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active else { return }
                Task {
                    await eventKit.syncMetadataIfReady()
                    await homeKit.syncMetadataIfReady()
                }
            }
        }
    }

    private var permissionLabel: String {
        switch model.photoPermission {
        case .authorized: return "전체 사진 메타데이터 읽기 허용"
        case .limited: return "선택한 사진 메타데이터만 허용"
        case .denied, .restricted: return "사진 접근이 차단됨"
        case .notDetermined: return "권한 확인 필요"
        @unknown default: return "권한 상태 확인 필요"
        }
    }
}
