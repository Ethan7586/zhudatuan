import AppKit
import AVFoundation
import CoreVideo
import Foundation

struct AcceptanceManifest: Decodable {
  let voice: String
  let rate: Int
  let chapters: [AcceptanceChapter]
}

struct AcceptanceChapter: Decodable {
  let name: String
  let title: String
  let segments: [AcceptanceSegment]
}

struct AcceptanceSegment: Decodable {
  let image: String
  let text: String
}

struct PreparedSegment {
  let image: URL
  let audio: URL
  let text: String
  let duration: CMTime
}

enum BuildFailure: Error, CustomStringConvertible {
  case invalidArguments
  case missingImage(String)
  case missingAudioTrack(String)
  case missingVideoTrack(String)
  case pixelBuffer
  case image(String)
  case writer(String)
  case export(String)
  case speech(String)

  var description: String {
    switch self {
    case .invalidArguments:
      return "usage: swift BuildNarratedVideo.swift <manifest.json>"
    case let .missingImage(path):
      return "missing image: \(path)"
    case let .missingAudioTrack(path):
      return "missing audio track: \(path)"
    case let .missingVideoTrack(path):
      return "missing video track: \(path)"
    case .pixelBuffer:
      return "unable to create video pixel buffer"
    case let .image(path):
      return "unable to decode image: \(path)"
    case let .writer(message):
      return "video writer failed: \(message)"
    case let .export(message):
      return "video export failed: \(message)"
    case let .speech(message):
      return "speech synthesis failed: \(message)"
    }
  }
}

@main
struct BuildNarratedVideo {
  private static let width = 1512
  private static let height = 744
  private static let frameDuration = CMTime(value: 1, timescale: 30)
  private static let segmentGap = CMTime(value: 9, timescale: 20)

  static func main() async throws {
    guard CommandLine.arguments.count == 2 else { throw BuildFailure.invalidArguments }
    let manifestURL = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
    let root = manifestURL.deletingLastPathComponent()
    let manifest = try JSONDecoder().decode(AcceptanceManifest.self, from: Data(contentsOf: manifestURL))
    let temporaryRoot = FileManager.default.temporaryDirectory
      .appendingPathComponent("ZhudatuanMvpAcceptance", isDirectory: true)
    let audioRoot = temporaryRoot.appendingPathComponent("Audio", isDirectory: true)
    if FileManager.default.fileExists(atPath: temporaryRoot.path) {
      try FileManager.default.removeItem(at: temporaryRoot)
    }
    try FileManager.default.createDirectory(at: audioRoot, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: temporaryRoot, withIntermediateDirectories: true)

    var transcript = "# 福利商城 MVP 本地 Chrome 验收讲解稿\n\n"
    for chapter in manifest.chapters {
      let prepared = try await prepare(
        chapter: chapter,
        root: root,
        audioRoot: audioRoot,
        voice: manifest.voice,
        rate: manifest.rate
      )
      let output = root.appendingPathComponent("\(chapter.name).mp4")
      let silentVideo = temporaryRoot.appendingPathComponent("\(chapter.name).mov")
      try await writeVideo(prepared, to: silentVideo)
      try await combine(prepared, video: silentVideo, output: output)
      transcript += "## \(chapter.title)\n\n"
      for (index, segment) in prepared.enumerated() {
        transcript += "\(index + 1). \(segment.text)\n"
      }
      transcript += "\n"
      print("BUILT \(output.path)")
    }
    try transcript.write(to: root.appendingPathComponent("Transcript.md"), atomically: true, encoding: .utf8)
    try FileManager.default.removeItem(at: temporaryRoot)
  }

  private static func prepare(
    chapter: AcceptanceChapter,
    root: URL,
    audioRoot: URL,
    voice: String,
    rate: Int
  ) async throws -> [PreparedSegment] {
    var result: [PreparedSegment] = []
    for (index, segment) in chapter.segments.enumerated() {
      let image = root.appendingPathComponent(segment.image)
      guard FileManager.default.fileExists(atPath: image.path) else {
        throw BuildFailure.missingImage(image.path)
      }
      let audio = audioRoot.appendingPathComponent(String(format: "%@-%03d.aiff", chapter.name, index + 1))
      try synthesize(segment.text, output: audio, voice: voice, rate: rate)
      let asset = AVURLAsset(url: audio)
      let duration = try await asset.load(.duration)
      result.append(PreparedSegment(image: image, audio: audio, text: segment.text, duration: duration))
    }
    return result
  }

  private static func synthesize(_ text: String, output: URL, voice: String, rate: Int) throws {
    if FileManager.default.fileExists(atPath: output.path) {
      try FileManager.default.removeItem(at: output)
    }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/say")
    process.arguments = ["-v", voice, "-r", String(rate), "-o", output.path, text]
    let error = Pipe()
    process.standardError = error
    try process.run()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else {
      let message = String(data: error.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "unknown"
      throw BuildFailure.speech(message)
    }
  }

  private static func writeVideo(_ segments: [PreparedSegment], to output: URL) async throws {
    if FileManager.default.fileExists(atPath: output.path) {
      try FileManager.default.removeItem(at: output)
    }
    let writer = try AVAssetWriter(outputURL: output, fileType: .mov)
    let settings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 4_000_000,
        AVVideoMaxKeyFrameIntervalKey: 30,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
      ],
    ]
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    input.expectsMediaDataInRealTime = false
    let attributes: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
      kCVPixelBufferIOSurfacePropertiesKey as String: [:],
    ]
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: attributes
    )
    guard writer.canAdd(input) else { throw BuildFailure.writer("video input rejected") }
    writer.add(input)
    guard writer.startWriting() else {
      throw BuildFailure.writer(writer.error?.localizedDescription ?? "startWriting")
    }
    writer.startSession(atSourceTime: .zero)

    var cursor = CMTime.zero
    var lastBuffer: CVPixelBuffer?
    for segment in segments {
      let buffer = try makePixelBuffer(segment.image)
      try await append(buffer, at: cursor, input: input, adaptor: adaptor, writer: writer)
      lastBuffer = buffer
      cursor = CMTimeAdd(cursor, segment.duration)
      cursor = CMTimeAdd(cursor, segmentGap)
    }
    if let lastBuffer {
      let finalPresentation = CMTimeSubtract(cursor, frameDuration)
      try await append(lastBuffer, at: finalPresentation, input: input, adaptor: adaptor, writer: writer)
    }
    input.markAsFinished()
    writer.endSession(atSourceTime: cursor)
    await writer.finishWriting()
    guard writer.status == .completed else {
      throw BuildFailure.writer(writer.error?.localizedDescription ?? "finishWriting")
    }
  }

  private static func append(
    _ buffer: CVPixelBuffer,
    at time: CMTime,
    input: AVAssetWriterInput,
    adaptor: AVAssetWriterInputPixelBufferAdaptor,
    writer: AVAssetWriter
  ) async throws {
    while !input.isReadyForMoreMediaData {
      if writer.status == .failed {
        throw BuildFailure.writer(writer.error?.localizedDescription ?? "append")
      }
      try await Task.sleep(for: .milliseconds(5))
    }
    guard adaptor.append(buffer, withPresentationTime: time) else {
      throw BuildFailure.writer(writer.error?.localizedDescription ?? "append")
    }
  }

  private static func makePixelBuffer(_ imageURL: URL) throws -> CVPixelBuffer {
    var pixelBuffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_32BGRA,
      [kCVPixelBufferIOSurfacePropertiesKey: [:]] as CFDictionary,
      &pixelBuffer
    )
    guard status == kCVReturnSuccess, let pixelBuffer else { throw BuildFailure.pixelBuffer }
    guard let image = NSImage(contentsOf: imageURL) else { throw BuildFailure.image(imageURL.path) }
    var proposed = NSRect(origin: .zero, size: image.size)
    guard let source = image.cgImage(forProposedRect: &proposed, context: nil, hints: nil) else {
      throw BuildFailure.image(imageURL.path)
    }

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
    guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { throw BuildFailure.pixelBuffer }
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    guard let context = CGContext(
      data: base,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: bytesPerRow,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: bitmapInfo
    ) else { throw BuildFailure.pixelBuffer }
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let scale = min(CGFloat(width) / CGFloat(source.width), CGFloat(height) / CGFloat(source.height))
    let drawnWidth = CGFloat(source.width) * scale
    let drawnHeight = CGFloat(source.height) * scale
    let rect = CGRect(
      x: (CGFloat(width) - drawnWidth) / 2,
      y: (CGFloat(height) - drawnHeight) / 2,
      width: drawnWidth,
      height: drawnHeight
    )
    context.draw(source, in: rect)
    return pixelBuffer
  }

  private static func combine(_ segments: [PreparedSegment], video: URL, output: URL) async throws {
    if FileManager.default.fileExists(atPath: output.path) {
      try FileManager.default.removeItem(at: output)
    }
    let composition = AVMutableComposition()
    guard let videoOutput = composition.addMutableTrack(
      withMediaType: .video,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else { throw BuildFailure.missingVideoTrack(video.path) }
    let videoAsset = AVURLAsset(url: video)
    guard let videoSource = try await videoAsset.loadTracks(withMediaType: .video).first else {
      throw BuildFailure.missingVideoTrack(video.path)
    }
    let total = segments.reduce(CMTime.zero) { partial, segment in
      CMTimeAdd(CMTimeAdd(partial, segment.duration), segmentGap)
    }
    try videoOutput.insertTimeRange(CMTimeRange(start: .zero, duration: total), of: videoSource, at: .zero)

    guard let audioOutput = composition.addMutableTrack(
      withMediaType: .audio,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else { throw BuildFailure.missingAudioTrack(output.path) }
    var cursor = CMTime.zero
    for segment in segments {
      let asset = AVURLAsset(url: segment.audio)
      guard let source = try await asset.loadTracks(withMediaType: .audio).first else {
        throw BuildFailure.missingAudioTrack(segment.audio.path)
      }
      try audioOutput.insertTimeRange(
        CMTimeRange(start: .zero, duration: segment.duration),
        of: source,
        at: cursor
      )
      cursor = CMTimeAdd(cursor, segment.duration)
      cursor = CMTimeAdd(cursor, segmentGap)
    }

    guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      throw BuildFailure.export("unable to create exporter")
    }
    try await exporter.export(to: output, as: .mp4)
  }
}
