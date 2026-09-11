// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "DoranDoranPhotosCompanion",
    platforms: [.iOS(.v17), .macOS(.v12)],
    products: [
        .library(name: "DoranDoranPhotosCompanion", targets: ["DoranDoranPhotosCompanion"]),
    ],
    targets: [
        .target(name: "DoranDoranPhotosCompanion"),
        .testTarget(name: "DoranDoranPhotosCompanionTests", dependencies: ["DoranDoranPhotosCompanion"]),
    ]
)
