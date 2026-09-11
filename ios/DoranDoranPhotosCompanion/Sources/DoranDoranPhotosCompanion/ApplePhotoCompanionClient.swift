import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public protocol ApplePhotoTokenStore: Sendable {
    func read() async throws -> String?
    func write(_ token: String) async throws
    func remove() async throws
}

public struct ApplePhotoIngestReceipt: Codable, Equatable, Sendable {
    public let status: String
    public let batchDigest: String
    public let eventCount: Int
    public let cursor: String
}

public enum ApplePhotoCompanionError: Error, Equatable {
    case invalidBaseURL
    case missingToken
    case rejected(Int, String)
}

@available(iOS 15, macOS 12, *)
public actor ApplePhotoCompanionClient {
    private let endpoint: URL
    private let tokenStore: any ApplePhotoTokenStore
    private let session: URLSession

    public init(baseURL: URL, tokenStore: any ApplePhotoTokenStore, session: URLSession = .shared) throws {
        guard baseURL.scheme == "https", baseURL.host != nil else { throw ApplePhotoCompanionError.invalidBaseURL }
        self.endpoint = baseURL.appendingPathComponent("api/photos/apple/metadata")
        self.tokenStore = tokenStore
        self.session = session
    }

    public func ingest(_ batch: ApplePhotoMetadataBatch) async throws -> ApplePhotoIngestReceipt {
        guard let token = try await tokenStore.read(), !token.isEmpty else { throw ApplePhotoCompanionError.missingToken }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(batch)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ApplePhotoCompanionError.rejected(0, "NON_HTTP_RESPONSE") }
        guard (200..<300).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "REQUEST_REJECTED"
            throw ApplePhotoCompanionError.rejected(http.statusCode, message)
        }
        let decoder = JSONDecoder()
        return try decoder.decode(ApplePhotoIngestReceipt.self, from: data)
    }
}
