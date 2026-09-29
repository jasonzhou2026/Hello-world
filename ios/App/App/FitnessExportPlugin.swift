import Capacitor
import UIKit

@objc(FitnessExportPlugin)
public class FitnessExportPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FitnessExportPlugin"
    public let jsName = "FitnessExport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise)
    ]

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename"),
              !filename.isEmpty,
              filename == (filename as NSString).lastPathComponent,
              ["pdf", "docx", "xlsx", "json"].contains((filename as NSString).pathExtension.lowercased()),
              let base64 = call.getString("base64"),
              let data = Data(base64Encoded: base64) else {
            call.reject("导出文件格式无效。")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let presenter = self?.bridge?.viewController,
                  presenter.presentedViewController == nil else {
                call.reject("请关闭当前窗口后重试。")
                return
            }
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("FitnessExports", isDirectory: true)
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let file = directory.appendingPathComponent(filename)
                try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                sheet.popoverPresentationController?.sourceView = presenter.view
                sheet.popoverPresentationController?.sourceRect = CGRect(
                    x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1
                )
                sheet.completionWithItemsHandler = { _, completed, _, error in
                    try? FileManager.default.removeItem(at: directory)
                    if let error = error {
                        call.reject(error.localizedDescription)
                    } else {
                        call.resolve(["completed": completed])
                    }
                }
                presenter.present(sheet, animated: true)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                call.reject("无法创建导出文件：\(error.localizedDescription)")
            }
        }
    }
}
