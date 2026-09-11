@preconcurrency import HomeKit
import Foundation
import SwiftUI

/// HomeKit is read-only here: labels and reachability are context, never live presence.
@MainActor
final class AppleHomeKitBridge: NSObject, ObservableObject, @preconcurrency HMHomeManagerDelegate {
    @Published private(set) var status = "HomeKit 권한 확인 필요"

    private let manager: HMHomeManager
    private let tokenStore = ApplePhotoKeychainTokenStore()
    private let client: AppleDigitalAtomCompanionClient?

    override init() {
        manager = HMHomeManager()
        client = try? AppleDigitalAtomCompanionClient(
            baseURL: URL(string: "https://dorandoran.link")!,
            tokenStore: tokenStore,
        )
        super.init()
        manager.delegate = self
    }

    func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        status = manager.authorizationStatus == .authorized
            ? "HomeKit 읽기 권한 허용 · 집 \(manager.homes.count)개"
            : "HomeKit 권한 확인 필요"
    }

    func syncMetadata() async {
        guard let client, let deviceId = UserDefaults.standard.string(forKey: "dorandoran.apple.device-id"), !deviceId.isEmpty else {
            status = "도란도란 기기 연결이 먼저 필요합니다."
            return
        }
        guard manager.authorizationStatus == .authorized else {
            status = "HomeKit 읽기 권한이 필요합니다."
            return
        }

        let formatter = ISO8601DateFormatter()
        let observedAt = formatter.string(from: Date())
        let events = manager.homes.flatMap { home in
            home.accessories.map { accessory in
                AppleDigitalAtomEvent(
                    eventId: accessory.uniqueIdentifier.uuidString,
                    kind: "home.context",
                    occurredAt: observedAt,
                    metadata: [
                        "homeId": home.uniqueIdentifier.uuidString,
                        "homeName": home.name,
                        "roomName": accessory.room?.name ?? "",
                        "accessoryId": accessory.uniqueIdentifier.uuidString,
                        "accessoryName": accessory.name,
                        "reachable": accessory.isReachable ? "true" : "false",
                        "serviceCount": String(accessory.services.count),
                    ],
                )
            }
        }
        do {
            let receipt = try await client.ingest(AppleDigitalAtomBatch(
                deviceId: deviceId,
                source: "home",
                cursor: "home-\(UUID().uuidString)",
                sentAt: observedAt,
                events: events,
            ))
            status = "HomeKit 메타데이터 동기화됨 · \(receipt.eventCount)건"
        } catch {
            status = "HomeKit 메타데이터 동기화 실패"
        }
    }
}
