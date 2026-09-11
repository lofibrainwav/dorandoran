import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct AppleDigitalAtomEvent: Codable, Sendable {
    public let eventId: String
    public let operation: String
    public let kind: String
    public let occurredAt: String
    public let metadata: [String: String]

    public init(eventId: String, operation: String = "upsert", kind: String, occurredAt: String, metadata: [String: String]) {
        self.eventId = eventId
        self.operation = operation
        self.kind = kind
        self.occurredAt = occurredAt
        self.metadata = metadata
    }
}

public struct AppleDigitalAtomBatch: Codable, Sendable {
    public let protocolVersion: Int
    public let deviceId: String
    public let source: String
    public let cursor: String
    public let sentAt: String
    public let events: [AppleDigitalAtomEvent]

    public init(deviceId: String, source: String, cursor: String, sentAt: String, events: [AppleDigitalAtomEvent]) {
        self.protocolVersion = 1
        self.deviceId = deviceId
        self.source = source
        self.cursor = cursor
        self.sentAt = sentAt
        self.events = events
    }
}

public struct AppleDigitalAtomIngestReceipt: Codable, Sendable {
    public let status: String
    public let batchDigest: String
    public let eventCount: Int
    public let cursor: String
}

public enum AppleDigitalAtomCompanionError: Error, Equatable {
    case invalidBaseURL
    case missingToken
    case rejected(Int, String)
}

@available(iOS 15, macOS 12, *)
public actor AppleDigitalAtomCompanionClient {
    private let endpoint: URL
    private let tokenStore: any ApplePhotoTokenStore
    private let session: URLSession

    public init(baseURL: URL, tokenStore: any ApplePhotoTokenStore, session: URLSession = .shared) throws {
        guard baseURL.scheme == "https", baseURL.host != nil else { throw AppleDigitalAtomCompanionError.invalidBaseURL }
        self.endpoint = baseURL.appendingPathComponent("api/apple/digital-atoms")
        self.tokenStore = tokenStore
        self.session = session
    }

    public func ingest(_ batch: AppleDigitalAtomBatch) async throws -> AppleDigitalAtomIngestReceipt {
        guard let token = try await tokenStore.read(), !token.isEmpty else { throw AppleDigitalAtomCompanionError.missingToken }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(batch)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AppleDigitalAtomCompanionError.rejected(0, "NON_HTTP_RESPONSE") }
        guard (200..<300).contains(http.statusCode) else {
            throw AppleDigitalAtomCompanionError.rejected(http.statusCode, String(data: data, encoding: .utf8) ?? "REQUEST_REJECTED")
        }
        return try JSONDecoder().decode(AppleDigitalAtomIngestReceipt.self, from: data)
    }
}
