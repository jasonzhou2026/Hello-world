import Capacitor
import Foundation

@objc(FitnessWidgetsPlugin)
public class FitnessWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FitnessWidgetsPlugin"
    public let jsName = "FitnessWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "completeToday", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise)
    ]

    @objc func sync(_ call: CAPPluginCall) {
        guard let date = call.getString("date"), FitnessWidgetStore.isValidDate(date),
              let title = call.getString("title"), let detail = call.getString("detail"),
              let progress = call.getDouble("progress"), progress.isFinite else {
            call.reject("Invalid widget snapshot")
            return
        }
        let snapshot = FitnessGoalSnapshot(date: date, title: String(title.prefix(120)),
            detail: String(detail.prefix(180)), progress: min(1, max(0, progress)))
        let dates = FitnessWidgetStore.sync(snapshot: snapshot, completionDates: call.getArray("completionDates", String.self) ?? [])
        call.resolve(["completionDates": dates, "openGoal": FitnessWidgetStore.consumeGoalOpened()])
    }

    @objc func completeToday(_ call: CAPPluginCall) {
        call.resolve(["completionDates": FitnessWidgetStore.completeToday()])
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve(["completionDates": FitnessWidgetStore.completionDates(), "openGoal": FitnessWidgetStore.consumeGoalOpened()])
    }
}
