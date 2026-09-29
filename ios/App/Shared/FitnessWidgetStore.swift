import Foundation
import WidgetKit

struct FitnessGoalSnapshot: Codable, Equatable {
    var date: String
    var title: String
    var detail: String
    var progress: Double

    static let empty = FitnessGoalSnapshot(date: "", title: "设置训练目标", detail: "打开 App 设置今日目标", progress: 0)
}

enum FitnessWidgetStore {
    static let appGroup = "group.com.jasonzhou.fitnesstracker"
    static let kinds = ["FitnessGoalGauge", "FitnessGoalRing", "FitnessGoalSwitch"]
    private static let snapshotKey = "fitness.goal.snapshot.v1"
    private static let completionPrefix = "fitness.goal.completed."
    private static let lock = NSLock()
    private static var goalOpened = false

    static func markGoalOpened() {
        lock.lock(); defer { lock.unlock() }
        goalOpened = true
    }

    static func consumeGoalOpened() -> Bool {
        lock.lock(); defer { lock.unlock() }
        let opened = goalOpened
        goalOpened = false
        return opened
    }

    static func localDate(_ date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func isValidDate(_ value: String) -> Bool {
        guard value.count == 10 else { return false }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        guard let date = formatter.date(from: value) else { return false }
        return formatter.string(from: date) == value
    }

    private static func defaults() -> UserDefaults {
        let defaults = UserDefaults(suiteName: appGroup)!
        // Flush and refresh at the app/extension boundary, including a just-finished intent.
        defaults.synchronize()
        return defaults
    }

    private static func dates(in defaults: UserDefaults) -> [String] {
        defaults.dictionaryRepresentation().compactMap { key, value in
            guard key.hasPrefix(completionPrefix), (value as? Bool) == true else { return nil }
            let date = String(key.dropFirst(completionPrefix.count))
            return isValidDate(date) ? date : nil
        }.sorted()
    }

    static func completionDates() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        return dates(in: defaults())
    }

    static func snapshot() -> FitnessGoalSnapshot {
        lock.lock()
        defer { lock.unlock() }
        guard let data = defaults().data(forKey: snapshotKey),
              let value = try? JSONDecoder().decode(FitnessGoalSnapshot.self, from: data) else { return .empty }
        return value
    }

    @discardableResult
    static func sync(snapshot: FitnessGoalSnapshot? = nil, completionDates: [String] = []) -> [String] {
        lock.lock()
        let defaults = defaults()
        var changed = false
        // Each date has its own monotonic key. A stale app snapshot cannot erase an intent's completion.
        for date in Set(completionDates) where isValidDate(date) {
            let key = completionPrefix + date
            if !defaults.bool(forKey: key) {
                defaults.set(true, forKey: key)
                changed = true
            }
        }
        if let snapshot, let data = try? JSONEncoder().encode(snapshot) {
            let previous = defaults.data(forKey: snapshotKey).flatMap { try? JSONDecoder().decode(FitnessGoalSnapshot.self, from: $0) }
            if previous != snapshot {
                defaults.set(data, forKey: snapshotKey)
                changed = true
            }
        }
        defaults.synchronize()
        let result = dates(in: defaults)
        lock.unlock()
        if changed { reloadWidgets() }
        return result
    }

    @discardableResult
    static func completeToday() -> [String] {
        sync(completionDates: [localDate()])
    }

    static func reloadWidgets() {
        for kind in kinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
    }
}
