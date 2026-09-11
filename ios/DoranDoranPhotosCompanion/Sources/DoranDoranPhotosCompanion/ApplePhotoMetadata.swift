import Foundation

public enum ApplePhotoMediaType: String, Codable, Sendable {
    case image
    case video
    case livePhoto = "live_photo"
    case unknown
}

public struct ApplePhotoMetadata: Codable, Equatable, Sendable {
    public let cloudId: String
    public let capturedAt: Date
    public let modifiedAt: Date
    public let mediaType: ApplePhotoMediaType
    public let latitude: Double?
    public let longitude: Double?

    public init(cloudId: String, capturedAt: Date, modifiedAt: Date, mediaType: ApplePhotoMediaType, latitude: Double? = nil, longitude: Double? = nil) {
        self.cloudId = cloudId
        self.capturedAt = capturedAt
        self.modifiedAt = modifiedAt
        self.mediaType = mediaType
        self.latitude = latitude
        self.longitude = longitude
    }
}

public enum ApplePhotoOperation: Codable, Equatable, Sendable {
    case upsert(ApplePhotoMetadata)
    case delete(String)

    private enum CodingKeys: String, CodingKey { case operation, photo, cloudId }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .operation) {
        case "upsert": self = .upsert(try container.decode(ApplePhotoMetadata.self, forKey: .photo))
        case "delete": self = .delete(try container.decode(String.self, forKey: .cloudId))
        default: throw DecodingError.dataCorruptedError(forKey: .operation, in: container, debugDescription: "Unsupported operation")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .upsert(let photo):
            try container.encode("upsert", forKey: .operation)
            try container.encode(photo, forKey: .photo)
        case .delete(let cloudId):
            try container.encode("delete", forKey: .operation)
            try container.encode(cloudId, forKey: .cloudId)
        }
    }
}

public struct ApplePhotoMetadataBatch: Codable, Equatable, Sendable {
    public let protocolVersion: Int
    public let deviceId: String
    public let libraryScope: String
    public let cursor: String
    public let sentAt: Date
    public let events: [ApplePhotoOperation]

    public init(deviceId: String, cursor: String, sentAt: Date = Date(), events: [ApplePhotoOperation]) {
        self.protocolVersion = 1
        self.deviceId = deviceId
        self.libraryScope = "family-shared"
        self.cursor = cursor
        self.sentAt = sentAt
        self.events = events
    }
}

