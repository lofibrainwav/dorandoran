import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct ApplePhotoDeviceRegistration: Codable, Equatable, Sendable {
    public let deviceId: String
    public let deviceToken: String
    public let libraryScope: String
}

@available(iOS 15, macOS 12, *)
public actor ApplePhotoPairingClient {
    private let endpoint: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) throws {
        guard baseURL.scheme == "https", baseURL.host != nil else { throw ApplePhotoCompanionError.invalidBaseURL }
        self.endpoint = baseURL.appendingPathComponent("api/photos/apple/devices/claim")
        self.session = session
    }

    public func claim(pairingCode: String, deviceName: String) async throws -> ApplePhotoDeviceRegistration {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "pairingCode": pairingCode,
            "deviceName": deviceName,
        ])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ApplePhotoCompanionError.rejected(0, "NON_HTTP_RESPONSE") }
        guard (200..<300).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "REQUEST_REJECTED"
            throw ApplePhotoCompanionError.rejected(http.statusCode, message)
        }
        return try JSONDecoder().decode(ApplePhotoDeviceRegistration.self, from: data)
    }

    public func claimAndStore(pairingCode: String, deviceName: String, tokenStore: any ApplePhotoTokenStore) async throws -> ApplePhotoDeviceRegistration {
        let registration = try await claim(pairingCode: pairingCode, deviceName: deviceName)
        try await tokenStore.write(registration.deviceToken)
        return registration
    }
}

