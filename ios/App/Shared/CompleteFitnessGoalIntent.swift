import AppIntents

@available(iOS 17.0, *)
struct CompleteFitnessGoalIntent: AppIntent {
    static var title: LocalizedStringResource = "完成今日目标"
    static var description = IntentDescription("将今天的训练目标标记为完成，不会新增训练记录。")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        FitnessWidgetStore.completeToday()
        return .result()
    }
}
