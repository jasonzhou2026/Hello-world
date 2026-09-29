import Capacitor
import UIKit
import WebKit
#if DEBUG
import SwiftUI
#endif

class FitnessViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FitnessExportPlugin())
        bridge?.registerPluginInstance(FitnessWidgetsPlugin())
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

#if DEBUG
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if ProcessInfo.processInfo.arguments.contains("--fitness-widget-preview") {
            let preview = UIHostingController(rootView: FitnessWidgetPreviewView(
                small: ProcessInfo.processInfo.arguments.contains("--fitness-widget-small")))
            preview.modalPresentationStyle = .fullScreen
            present(preview, animated: false)
            return
        }
        guard ProcessInfo.processInfo.arguments.contains("--fitness-smoke-test") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            let script = """
            const db = await new Promise((resolve, reject) => {
              const request = indexedDB.open('fitness-native-smoke', 1);
              request.onupgradeneeded = () => request.result.createObjectStore('checks');
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            const persisted = await new Promise((resolve, reject) => {
              const tx = db.transaction('checks', 'readwrite');
              const request = tx.objectStore('checks').get('launch');
              let previous;
              request.onsuccess = () => {
                previous = request.result;
                tx.objectStore('checks').put('ok', 'launch');
              };
              tx.oncomplete = () => resolve(previous === 'ok');
              tx.onerror = () => reject(tx.error);
            });
            db.close();
            if (screen) document.querySelector(`[data-tab="${screen}"]`)?.click();
            const result = { title: document.title, local: location.origin === 'capacitor://localhost',
              rendered: document.querySelectorAll('#app button').length > 3,
              share: Capacitor.isPluginAvailable('FitnessExport'), persisted,
              widgets: Capacitor.isPluginAvailable('FitnessWidgets') };
            if (widgets) {
              const plugin = Capacitor.Plugins.FitnessWidgets;
              result.widgetBefore = await plugin.getState();
              result.widgetComplete = await plugin.completeToday();
              result.widgetAgain = await plugin.completeToday();
              result.widgetPersisted = await plugin.getState();
            }
            if (format) {
              const exports = await import('./src/export/reports.js');
              const input = { weekStart: '2026-09-28', foodEntries: [], trainingSessions: [] };
              const buffer = format === 'pdf' ? await exports.createReportPdfBuffer(input) : exports.createReportDocxBuffer(input);
              const bytes = new Uint8Array(buffer);
              let binary = '';
              for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
              result.exportBytes = bytes.length;
              result.exportHeader = binary.slice(0, 4);
              Capacitor.Plugins.FitnessExport.shareFile({ base64: btoa(binary), filename: 'native-report-test.' + format });
            }
            return result;
            """
            let format = ProcessInfo.processInfo.arguments.contains("--fitness-share-pdf") ? "pdf"
                : ProcessInfo.processInfo.arguments.contains("--fitness-share-docx") ? "docx" : ""
            let screen = ["overview", "food", "training", "reports"].first {
                ProcessInfo.processInfo.arguments.contains("--fitness-screen-\($0)")
            } ?? ""
            self?.webView?.callAsyncJavaScript(script, arguments: ["format": format, "screen": screen, "widgets": ProcessInfo.processInfo.arguments.contains("--fitness-widget-smoke")], in: nil, in: .page) { result in
                var payload: [String: Any]
                switch result {
                case .success(let value): payload = value as? [String: Any] ?? ["error": "Unexpected smoke result"]
                case .failure(let error): payload = ["error": error.localizedDescription]
                }
                if ProcessInfo.processInfo.arguments.contains("--fitness-widget-smoke") {
                    let now = Date()
                    let tomorrow = Calendar(identifier: .gregorian).date(byAdding: .day, value: 1, to: now)!
                    let fixture = FitnessGoalSnapshot(date: FitnessWidgetStore.localDate(now), title: "深蹲", detail: "100 kg", progress: 0.74)
                    let stale = FitnessGoalEntry(date: tomorrow, goal: fixture, isComplete: false)
                    let before = FitnessWidgetStore.completionDates()
                    let after = FitnessWidgetStore.sync(completionDates: ["2026-02-30", "invalid"])
                    payload["widgetNativeChecks"] = [
                        "invalidDatesRejected": !FitnessWidgetStore.isValidDate("2026-02-30") && !FitnessWidgetStore.isValidDate("invalid"),
                        "leapDateAccepted": FitnessWidgetStore.isValidDate("2028-02-29"),
                        "midnightProgressResets": stale.progress == 0,
                        "staleSyncPreservesCompletion": before == after
                    ]
                }
                let file = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                    .appendingPathComponent("native-smoke-result.json")
                if let data = try? JSONSerialization.data(withJSONObject: payload, options: .sortedKeys) {
                    try? data.write(to: file)
                }
            }
        }
    }
#endif
}
