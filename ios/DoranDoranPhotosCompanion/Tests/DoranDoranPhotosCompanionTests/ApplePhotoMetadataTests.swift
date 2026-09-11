import Foundation
import Testing
@testable import DoranDoranPhotosCompanion

@Test("metadata batch encodes only the server contract")
func metadataBatchContract() throws {
    let batch = ApplePhotoMetadataBatch(
        deviceId: "iphone-julie-01",
        cursor: "cursor-001",
        events: [.upsert(ApplePhotoMetadata(
            cloudId: "asset-1",
            capturedAt: Date(timeIntervalSince1970: 1_000),
            modifiedAt: Date(timeIntervalSince1970: 1_001),
            mediaType: .image,
            latitude: 34.0,
            longitude: -118.0
        ))]
    )
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    let data = try encoder.encode(batch)
    let json = try #require(String(data: data, encoding: .utf8))
    #expect(json.contains("deviceId"))
    #expect(json.contains("capturedAt"))
    #expect(!json.contains("thumbnail"))
    #expect(!json.contains("exif"))
    #expect(!json.contains("imageData"))
}

