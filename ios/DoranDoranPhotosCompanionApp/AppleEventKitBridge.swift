import EventKit
import Foundation
import SwiftUI

@MainActor
final class AppleEventKitBridge: ObservableObject {
    @Published private(set) var calendarStatus = "권한 확인 필요"
    @Published private(set) var remindersStatus = "권한 확인 필요"
    @Published private(set) var metadataStatus = "아직 메타데이터를 읽지 않았습니다."

    private let store = EKEventStore()
    private let tokenStore = ApplePhotoKeychainTokenStore()
    private let client: AppleDigitalAtomCompanionClient?

    init() {
        client = try? AppleDigitalAtomCompanionClient(
            baseURL: URL(string: "https://dorandoran.link")!,
            tokenStore: tokenStore,
        )
    }

    func requestAccess() async {
        do {
            let granted = try await store.requestFullAccessToEvents()
            calendarStatus = granted ? "Calendar 메타데이터 읽기 허용" : "Calendar 권한 거부"
        } catch {
            calendarStatus = "Calendar 권한 요청 실패"
        }

        do {
            let granted = try await store.requestFullAccessToReminders()
            remindersStatus = granted ? "Reminders 메타데이터 읽기 허용" : "Reminders 권한 거부"
        } catch {
            remindersStatus = "Reminders 권한 요청 실패"
        }
    }

    func syncMetadataWindow() async {
        guard let client, let deviceId = UserDefaults.standard.string(forKey: "dorandoran.apple.device-id"), !deviceId.isEmpty else {
            metadataStatus = "도란도란 기기 연결이 먼저 필요합니다."
            return
        }

        let sentAt = ISO8601DateFormatter().string(from: Date())
        let calendarEvents = readCalendarMetadata()
        let reminderEvents = await readReminderMetadata()
        do {
            let calendarReceipt = try await client.ingest(AppleDigitalAtomBatch(
                deviceId: deviceId,
                source: "calendar",
                cursor: "calendar-\(UUID().uuidString)",
                sentAt: sentAt,
                events: calendarEvents,
            ))
            let reminderReceipt = try await client.ingest(AppleDigitalAtomBatch(
                deviceId: deviceId,
                source: "reminders",
                cursor: "reminders-\(UUID().uuidString)",
                sentAt: sentAt,
                events: reminderEvents,
            ))
            metadataStatus = "동기화됨 · Calendar \(calendarReceipt.eventCount)건 · Reminders \(reminderReceipt.eventCount)건"
        } catch {
            metadataStatus = "동기화 실패 · 서버 연결 또는 기기 pairing을 확인해 주세요."
        }
    }

    private func readCalendarMetadata() -> [AppleDigitalAtomEvent] {
        let start = Calendar.current.date(byAdding: .day, value: -30, to: Date()) ?? Date()
        let end = Calendar.current.date(byAdding: .day, value: 180, to: Date()) ?? Date()
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let formatter = ISO8601DateFormatter()
        return store.events(matching: predicate).compactMap { event in
            guard let eventId = event.eventIdentifier else { return nil }
            var metadata: [String: String] = [
                "eventId": eventId,
                "calendarId": event.calendar.calendarIdentifier,
                "title": event.title ?? "",
                "allDay": event.isAllDay ? "true" : "false",
                "status": String(event.status.rawValue),
            ]
            if let start = event.startDate { metadata["start"] = formatter.string(from: start) }
            if let end = event.endDate { metadata["end"] = formatter.string(from: end) }
            if let timeZone = event.timeZone?.identifier { metadata["timeZone"] = timeZone }
            if let location = event.location, !location.isEmpty { metadata["location"] = location }
            if let modified = event.lastModifiedDate { metadata["modifiedAt"] = formatter.string(from: modified) }
            return AppleDigitalAtomEvent(eventId: eventId, kind: "schedule", occurredAt: formatter.string(from: event.startDate ?? Date()), metadata: metadata)
        }
    }

    private func readReminderMetadata() async -> [AppleDigitalAtomEvent] {
        await withCheckedContinuation { continuation in
            let predicate = store.predicateForReminders(in: nil)
            store.fetchReminders(matching: predicate) { reminders in
                let formatter = ISO8601DateFormatter()
                let events = reminders?.compactMap { reminder -> AppleDigitalAtomEvent? in
                    let eventId = reminder.calendarItemIdentifier
                    guard !eventId.isEmpty else { return nil }
                    var metadata: [String: String] = [
                        "reminderId": eventId,
                        "listId": reminder.calendar.calendarIdentifier,
                        "title": reminder.title ?? "",
                        "completed": reminder.isCompleted ? "true" : "false",
                        "priority": String(reminder.priority),
                    ]
                    if let due = reminder.dueDateComponents, let date = Calendar.current.date(from: due) { metadata["dueAt"] = formatter.string(from: date) }
                    if let modified = reminder.lastModifiedDate { metadata["modifiedAt"] = formatter.string(from: modified) }
                    return AppleDigitalAtomEvent(eventId: eventId, kind: "reminder", occurredAt: formatter.string(from: reminder.lastModifiedDate ?? Date()), metadata: metadata)
                } ?? []
                continuation.resume(returning: events)
            }
        }
    }
}
