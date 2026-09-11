#if canImport(Photos)
import Foundation
import Photos

public protocol ApplePhotoCursorStore: Sendable {
    func read() async throws -> String?
    func write(_ cursor: String) async throws
}

/// Converts PhotoKit change callbacks into metadata-only operations.
/// It never requests image data, thumbnails, resources, or raw EXIF.
@available(iOS 17, macOS 14, *)
public final class PhotoKitMetadataChangeStream: NSObject, PHPhotoLibraryChangeObserver, @unchecked Sendable {
    private let callback: @Sendable ([ApplePhotoOperation]) -> Void
    private let queue: DispatchQueue
    private let mediaTypes: Set<PHAssetMediaType>
    private var fetchResult: PHFetchResult<PHAsset>
    private let lock = NSLock()

    public init(
        mediaTypes: Set<PHAssetMediaType> = [.image, .video],
        queue: DispatchQueue = DispatchQueue(label: "link.dorandoran.photos.metadata-stream"),
        callback: @escaping @Sendable ([ApplePhotoOperation]) -> Void
    ) {
        self.queue = queue
        self.mediaTypes = mediaTypes
        self.callback = callback
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        options.includeAssetSourceTypes = [.typeUserLibrary, .typeCloudShared]
        self.fetchResult = PHAsset.fetchAssets(with: options)
        super.init()
    }

    public func start() {
        PHPhotoLibrary.shared().register(self)
    }

    public func stop() {
        PHPhotoLibrary.shared().unregisterChangeObserver(self)
    }

    public func photoLibraryDidChange(_ changeInstance: PHChange) {
        queue.async { [weak self] in
            guard let self else { return }
            self.lock.lock()
            defer { self.lock.unlock() }
            guard let details = changeInstance.changeDetails(for: self.fetchResult) else { return }

            let deleted = details.removedObjects.map { ApplePhotoOperation.delete($0.localIdentifier) }
            let inserted = details.insertedObjects.filter { self.mediaTypes.contains($0.mediaType) }.compactMap { PhotoKitMetadataProjector.project($0) }.map(ApplePhotoOperation.upsert)
            let changed = details.changedObjects.filter { self.mediaTypes.contains($0.mediaType) }.compactMap { PhotoKitMetadataProjector.project($0) }.map(ApplePhotoOperation.upsert)
            self.fetchResult = details.fetchResultAfterChanges
            let operations = inserted + changed + deleted
            guard !operations.isEmpty else { return }
            self.callback(operations)
        }
    }
}

@available(iOS 17, macOS 14, *)
public enum PhotoKitMetadataCollector {
    /// Performs an initial metadata-only snapshot bounded by the server batch limit.
    public static func collect(limit: Int = 500) -> [ApplePhotoMetadata] {
        guard limit > 0 else { return [] }
        let options = PHFetchOptions()
        options.fetchLimit = limit
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        options.includeAssetSourceTypes = [.typeUserLibrary, .typeCloudShared]
        let assets = PHAsset.fetchAssets(with: options)
        var result: [ApplePhotoMetadata] = []
        result.reserveCapacity(min(limit, assets.count))
        assets.enumerateObjects { asset, _, _ in
            if let metadata = PhotoKitMetadataProjector.project(asset) { result.append(metadata) }
        }
        return result
    }
}
#endif
