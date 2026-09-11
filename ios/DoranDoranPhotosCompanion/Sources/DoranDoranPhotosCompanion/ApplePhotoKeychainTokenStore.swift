import Foundation

#if canImport(Security)
import Security

public enum ApplePhotoKeychainError: Error, Equatable {
    case unexpectedStatus(OSStatus)
}

/// Stores only the opaque device bearer token. Pairing codes are never persisted here.
public final class ApplePhotoKeychainTokenStore: ApplePhotoTokenStore, @unchecked Sendable {
    private let service: String
    private let account: String

    public init(service: String = "link.dorandoran.photos", account: String = "apple-photo-device-token") {
        self.service = service
        self.account = account
    }

    public func read() async throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw ApplePhotoKeychainError.unexpectedStatus(status) }
        guard let data = result as? Data, let token = String(data: data, encoding: .utf8) else { return nil }
        return token
    }

    public func write(_ token: String) async throws {
        guard !token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        try await remove()
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: Data(token.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw ApplePhotoKeychainError.unexpectedStatus(status) }
    }

    public func remove() async throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw ApplePhotoKeychainError.unexpectedStatus(status) }
    }
}
#endif

