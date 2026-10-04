import Foundation
import Vision
import ImageIO
import UniformTypeIdentifiers

do {
    guard CommandLine.arguments.count >= 3 else { throw NSError(domain: "reader", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing image path"]) }
    let url = URL(fileURLWithPath: CommandLine.arguments[1])
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 2400
          ] as CFDictionary) else { throw NSError(domain: "reader", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot open this photo"]) }
    let destinationURL = URL(fileURLWithPath: CommandLine.arguments[2])
    if let destination = CGImageDestinationCreateWithURL(destinationURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) {
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.88] as CFDictionary)
        CGImageDestinationFinalize(destination)
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["en-US"]
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    let result = (request.results ?? []).compactMap { observation -> [String: Any]? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        return ["text": candidate.string, "confidence": candidate.confidence,
                "x": observation.boundingBox.minX, "y": 1-observation.boundingBox.maxY,
                "width": observation.boundingBox.width, "height": observation.boundingBox.height]
    }
    let data = try JSONSerialization.data(withJSONObject: result)
    print(String(data: data, encoding: .utf8)!)
} catch {
    FileHandle.standardError.write(Data("The local reader could not open or read this photo.\n".utf8))
    exit(1)
}
