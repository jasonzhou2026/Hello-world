import SwiftUI
import WidgetKit

struct FitnessGoalProvider: TimelineProvider {
    func placeholder(in context: Context) -> FitnessGoalEntry { .preview }
    func getSnapshot(in context: Context, completion: @escaping (FitnessGoalEntry) -> Void) {
        completion(context.isPreview ? .preview : .current())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<FitnessGoalEntry>) -> Void) {
        let now = Date()
        let calendar = Calendar(identifier: .gregorian)
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        // Pre-render tomorrow's reset; the system can defer requesting another timeline.
        completion(Timeline(entries: [.current(at: now), .current(at: midnight)], policy: .after(midnight)))
    }
}

struct FitnessGaugeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FitnessGoalGauge", provider: FitnessGoalProvider()) { entry in
            FitnessWidgetView(entry: entry, style: .gauge)
        }
        .configurationDisplayName("今日目标 · 深灰进度")
        .description("点阵数字与黄色刻度，查看重量目标并完成今日任务。")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}
struct FitnessRingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FitnessGoalRing", provider: FitnessGoalProvider()) { entry in
            FitnessWidgetView(entry: entry, style: .ring)
        }
        .configurationDisplayName("今日目标 · 紫色圆环")
        .description("紫色渐变与黄色进度环，查看重量目标并完成今日任务。")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}
struct FitnessSwitchWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FitnessGoalSwitch", provider: FitnessGoalProvider()) { entry in
            FitnessWidgetView(entry: entry, style: .toggle)
        }
        .configurationDisplayName("今日目标 · 深蓝开关")
        .description("深蓝渐变与打卡开关，一键完成今日任务。")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

@main
struct FitnessWidgetsBundle: WidgetBundle {
    var body: some Widget {
        FitnessGaugeWidget()
        FitnessRingWidget()
        FitnessSwitchWidget()
    }
}
