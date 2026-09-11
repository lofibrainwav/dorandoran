@preconcurrency import AppIntents
import Foundation

struct RecordDoranDoranActionIntent: AppIntent {
    static let title: LocalizedStringResource = "도란도란 액션 기록"
    static let description = IntentDescription("도란도란에 Shortcuts 실행 결과를 메타데이터로 기록합니다.")
    static let openAppWhenRun = false

    @Parameter(title: "액션 ID")
    var actionId: String

    @Parameter(title: "표시 이름")
    var label: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let deviceId = UserDefaults.standard.string(forKey: "dorandoran.apple.device-id"), !deviceId.isEmpty else {
            return .result(dialog: "먼저 도란도란 iPhone 연결을 완료해 주세요.")
        }

        do {
            let tokenStore = ApplePhotoKeychainTokenStore()
            let client = try AppleDigitalAtomCompanionClient(
                baseURL: URL(string: "https://dorandoran.link")!,
                tokenStore: tokenStore,
            )
            let now = ISO8601DateFormatter().string(from: Date())
            _ = try await client.ingest(AppleDigitalAtomBatch(
                deviceId: deviceId,
                source: "shortcuts",
                cursor: "shortcut-\(UUID().uuidString)",
                sentAt: now,
                events: [AppleDigitalAtomEvent(
                    eventId: UUID().uuidString,
                    kind: "action.completed",
                    occurredAt: now,
                    metadata: ["shortcutName": label, "actionId": actionId, "completedAt": now],
                )],
            ))
            return .result(dialog: "도란도란에 \(label)을 기록했습니다.")
        } catch {
            return .result(dialog: "도란도란에 연결하지 못했습니다. 나중에 다시 시도해 주세요.")
        }
    }
}

struct DoranDoranShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: RecordDoranDoranActionIntent(),
            phrases: ["\(.applicationName)에 액션 기록하기", "Record an action in \(.applicationName)"],
            shortTitle: "액션 기록",
            systemImageName: "square.and.pencil",
        )
    }
}
