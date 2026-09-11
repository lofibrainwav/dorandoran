#if canImport(Photos)
import Foundation
import Photos

public enum PhotoKitMetadataProjector {
    public static func project(_ asset: PHAsset) -> ApplePhotoMetadata? {
        guard !asset.localIdentifier.isEmpty, let capturedAt = asset.creationDate else { return nil }
        let modifiedAt = asset.modificationDate ?? capturedAt
        let mediaType: ApplePhotoMediaType
        switch asset.mediaType {
        case .image: mediaType = asset.mediaSubtypes.contains(.photoLive) ? .livePhoto : .image
        case .video: mediaType = .video
        default: mediaType = .unknown
        }
        let coordinate = asset.location?.coordinate
        return ApplePhotoMetadata(
            cloudId: asset.localIdentifier,
            capturedAt: capturedAt,
            modifiedAt: modifiedAt,
            mediaType: mediaType,
            latitude: coordinate?.latitude,
            longitude: coordinate?.longitude
        )
    }
}
#endif

