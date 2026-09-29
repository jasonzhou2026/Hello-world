import SwiftUI
import WidgetKit

struct FitnessGoalEntry: TimelineEntry {
    let date: Date
    let goal: FitnessGoalSnapshot
    let isComplete: Bool

    var progress: Double { goal.date == FitnessWidgetStore.localDate(date) ? goal.progress : 0 }
    static func current(at date: Date = Date()) -> FitnessGoalEntry {
        FitnessGoalEntry(date: date, goal: FitnessWidgetStore.snapshot(),
            isComplete: FitnessWidgetStore.completionDates().contains(FitnessWidgetStore.localDate(date)))
    }
    static var preview: FitnessGoalEntry {
        FitnessGoalEntry(date: Date(), goal: FitnessGoalSnapshot(date: FitnessWidgetStore.localDate(),
            title: "深蹲", detail: "股四头肌 · 100 kg", progress: 0.74), isComplete: false)
    }
}

enum FitnessWidgetStyle {
    case gauge, ring, toggle
}

private let goalYellow = Color(red: 1, green: 0.86, blue: 0.25)
private func widgetColor(_ hex: UInt32) -> Color {
    Color(red: Double((hex >> 16) & 255) / 255,
          green: Double((hex >> 8) & 255) / 255,
          blue: Double(hex & 255) / 255)
}

struct FitnessWidgetView: View {
    let entry: FitnessGoalEntry
    let style: FitnessWidgetStyle
    var previewInApp = false
    var previewFamily: WidgetFamily? = nil
    @Environment(\.widgetFamily) private var family
    private var isSmall: Bool { (previewFamily ?? family) == .systemSmall }
    private var cornerRadius: CGFloat { isSmall ? 34 : 42 }

    var body: some View {
        Group {
            if previewInApp {
                content.background(background).clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            } else if #available(iOS 17.0, *) {
                content.containerBackground(for: .widget) { background }
            } else {
                content.background(background)
            }
        }
        .widgetURL(widgetDestination)
    }

    private var widgetDestination: URL? {
        if #available(iOS 17.0, *) { return URL(string: "fitnesstracker://goal") }
        return URL(string: "fitnesstracker://complete-goal")
    }

    private var background: some View {
        GeometryReader { geometry in
            let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            ZStack {
                if style == .gauge {
                    widgetColor(0x151517)
                    RadialGradient(colors: [widgetColor(0x343436), widgetColor(0x28282b), .clear],
                        center: UnitPoint(x: 0.49, y: 0.6), startRadius: 0, endRadius: geometry.size.width * 0.65)
                    shape.inset(by: 5).strokeBorder(.white.opacity(0.07), lineWidth: 10).blur(radius: 11)
                } else if style == .ring {
                    widgetColor(0x591975)
                    RadialGradient(colors: [widgetColor(0xc88cbc).opacity(0.92), widgetColor(0x913f9e).opacity(0.6), .clear],
                        center: UnitPoint(x: 0.12, y: 0.05), startRadius: 0, endRadius: geometry.size.width * 0.82)
                    RadialGradient(colors: [widgetColor(0x4c115f).opacity(0.85), .clear],
                        center: UnitPoint(x: 0.63, y: 0.6), startRadius: 0, endRadius: geometry.size.width * 0.36)
                    shape.inset(by: 6).strokeBorder(
                        LinearGradient(colors: [widgetColor(0xf4cae3).opacity(0.76), widgetColor(0xc27ad3).opacity(0.48), widgetColor(0xca71d2).opacity(0.55)],
                            startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 19)
                        .blur(radius: 13)
                } else {
                    widgetColor(0x06091f)
                    RadialGradient(colors: [widgetColor(0x17143d).opacity(0.4), .clear],
                        center: UnitPoint(x: 0.6, y: 0.5), startRadius: 0, endRadius: geometry.size.width * 0.55)
                    shape.inset(by: 5).strokeBorder(
                        LinearGradient(colors: [widgetColor(0x9186c5).opacity(0.82), widgetColor(0x625294).opacity(0.63), widgetColor(0x8270ba).opacity(0.85)],
                            startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 24)
                        .blur(radius: 13)
                    shape.inset(by: 1).strokeBorder(widgetColor(0x9a8dcb).opacity(0.22), lineWidth: 6).blur(radius: 6)
                }
                shape.strokeBorder(
                    LinearGradient(stops: [
                        .init(color: .white.opacity(style == .gauge ? 0.08 : 0.32), location: 0),
                        .init(color: .white.opacity(0.035), location: 0.42),
                        .init(color: .white.opacity(style == .gauge ? 0.04 : 0.17), location: 1)
                    ], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 0.65)
            }
            .clipShape(shape)
            .background(widgetColor(style == .gauge ? 0x151517 : style == .ring ? 0x591975 : 0x06091f))
        }
    }

    private var content: some View {
        Group {
            if style == .gauge { gaugeContent }
            else { illuminatedContent }
        }
        .foregroundStyle(.white.opacity(0.94))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var gaugeContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("今日目标").font(.system(size: isSmall ? 16 : 18, weight: .regular))
                if !isSmall {
                    Spacer(minLength: 8)
                    goalName
                }
            }
            if isSmall { goalName.padding(.top, 4) }
            Spacer(minLength: 6)
            DotMatrixPercent(value: Int((entry.progress * 100).rounded()))
                .frame(width: isSmall ? 98 : 119, height: isSmall ? 34 : 41)
                .frame(maxWidth: .infinity)
                .accessibilityLabel("重量进度百分之\(Int(entry.progress * 100))")
            Spacer(minLength: 9)
            gaugeLine.frame(height: 8)
            completionButton.padding(.top, isSmall ? 9 : 12)
        }
        .padding(.horizontal, isSmall ? 21 : 26)
        .padding(.top, isSmall ? 20 : 22)
        .padding(.bottom, isSmall ? 17 : 18)
    }

    private var gaugeLine: some View {
        GeometryReader { geometry in
            ZStack(alignment: .topLeading) {
                Path { path in
                    path.move(to: CGPoint(x: 0, y: 3))
                    path.addLine(to: CGPoint(x: geometry.size.width, y: 3))
                }
                .stroke(.white.opacity(0.3), style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: [0.6, 3.2]))
                Rectangle().fill(LinearGradient(colors: [goalYellow.opacity(0.15), goalYellow], startPoint: .leading, endPoint: .trailing))
                    .frame(width: geometry.size.width * entry.progress, height: 1.2).offset(y: 2.4)
                    .shadow(color: goalYellow.opacity(0.3), radius: 2)
                Image(systemName: "triangle.fill").font(.system(size: 8, weight: .light)).rotationEffect(.degrees(180))
                    .foregroundStyle(goalYellow)
                    .offset(x: max(0, min(geometry.size.width - 8, geometry.size.width * entry.progress - 4)), y: 0)
            }
        }
    }

    private var illuminatedContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isSmall {
                Text("今日目标").font(.system(size: 16, weight: .regular))
                Spacer(minLength: 6)
                HStack(spacing: 7) {
                    goalName.frame(maxWidth: .infinity, alignment: .leading)
                    if style == .ring { progressRing } else { toggleControl }
                }
                Spacer(minLength: 8)
            } else {
                HStack(alignment: .center, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("今日目标").font(.system(size: 21, weight: .regular))
                        goalName
                    }
                    Spacer(minLength: 0)
                    if style == .ring { progressRing } else { toggleControl }
                }.frame(maxHeight: .infinity)
            }
            completionButton
        }
        .padding(.horizontal, isSmall ? 21 : 28)
        .padding(.top, isSmall ? 21 : 23)
        .padding(.bottom, isSmall ? 18 : 20)
    }

    private var goalName: some View {
        let target = entry.goal.detail.components(separatedBy: " · ").last ?? ""
        let label = target.hasSuffix(" kg") ? "\(entry.goal.title) · \(target)" : entry.goal.title
        return Text(label)
            .font(.system(size: isSmall ? 10 : 11, weight: .regular))
            .foregroundStyle(.white.opacity(0.52))
            .lineLimit(isSmall ? 2 : 1).minimumScaleFactor(0.85)
    }

    private var progressRing: some View {
        ZStack {
            Circle().stroke(.white.opacity(0.15), lineWidth: 0.8)
            Circle().trim(from: 0.52, to: 0.98)
                .stroke(.white.opacity(0.22), style: StrokeStyle(lineWidth: 1.8, dash: [0.65, 2.4]))
                .rotationEffect(.degrees(-90))
            Circle().trim(from: 0, to: entry.progress)
                .stroke(goalYellow.opacity(0.22), style: StrokeStyle(lineWidth: 4.5, lineCap: .round))
                .blur(radius: 2).rotationEffect(.degrees(-90))
            Circle().trim(from: 0, to: entry.progress)
                .stroke(LinearGradient(colors: [goalYellow, widgetColor(0xe9bd4d)], startPoint: .top, endPoint: .bottom),
                    style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
                .rotationEffect(.degrees(-90))
            DotMatrixPercent(value: Int((entry.progress * 100).rounded()))
                .frame(width: isSmall ? 43 : 54, height: isSmall ? 16 : 19)
                .opacity(0.88)
        }
        .frame(width: isSmall ? 63 : 88, height: isSmall ? 63 : 88)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("重量进度百分之\(Int(entry.progress * 100))")
    }

    @ViewBuilder private var toggleControl: some View {
        if #available(iOS 17.0, *) {
            Button(intent: CompleteFitnessGoalIntent()) { toggleGraphic }
                .buttonStyle(.plain).disabled(entry.isComplete)
        } else { toggleGraphic }
    }

    private var toggleGraphic: some View {
        let diameter: CGFloat = isSmall ? 29 : 39
        return ZStack(alignment: entry.isComplete ? .trailing : .leading) {
            Capsule().fill(LinearGradient(colors: entry.isComplete
                ? [goalYellow.opacity(0.75), goalYellow.opacity(0.45)]
                : [widgetColor(0x393950), widgetColor(0x26293f)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay { Capsule().strokeBorder(.white.opacity(0.045), lineWidth: 0.7) }
                .shadow(color: .black.opacity(0.24), radius: 4, x: 2, y: 4)
            Circle().fill(LinearGradient(colors: [widgetColor(0xffffff), widgetColor(0xe9eaf0)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay { Circle().strokeBorder(.white.opacity(0.88), lineWidth: 0.8) }
                .overlay {
                    if entry.isComplete { Image(systemName: "checkmark").font(.system(size: 11, weight: .medium)).foregroundStyle(widgetColor(0x292a3b)) }
                }
                .shadow(color: .black.opacity(0.28), radius: 3, x: 1, y: 2)
                .frame(width: diameter, height: diameter)
                .padding(1)
        }
        .frame(width: isSmall ? 60 : 84, height: diameter + 2)
        .accessibilityLabel(entry.isComplete ? "今日已完成" : "点击完成任务")
    }

    @ViewBuilder private var completionButton: some View {
        if #available(iOS 17.0, *) {
            Button(intent: CompleteFitnessGoalIntent()) { completionLabel }
                .buttonStyle(.plain).disabled(entry.isComplete)
        } else { completionLabel }
    }

    private var completionLabel: some View {
        Text(entry.isComplete ? "今日已完成" : "点击完成任务")
            .font(.system(size: isSmall ? 10 : 11, weight: .regular))
            .foregroundStyle(entry.isComplete ? goalYellow.opacity(0.9) : .white.opacity(0.68))
            .lineLimit(1).minimumScaleFactor(0.85)
            .frame(maxWidth: .infinity, minHeight: 18, alignment: .leading)
            .contentShape(Rectangle())
            .accessibilityLabel(entry.isComplete ? "今日已完成" : "点击完成任务")
    }
}

private struct DotMatrixPercent: View {
    let value: Int
    private let glyphs: [Character: [String]] = [
        "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
        "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
        "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
        "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
        "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
        "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
        "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
        "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
        "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
        "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
        "%": ["11001", "11001", "00010", "00100", "01000", "10011", "10011"]
    ]
    var body: some View {
        Canvas { context, size in
            let letters = Array("\(value)%")
            let columns = letters.count * 6 - 1
            let step = min(size.width / CGFloat(columns), size.height / 7)
            let dot = step * 0.46
            let origin = CGPoint(x: (size.width - CGFloat(columns - 1) * step - dot) / 2,
                y: (size.height - 6 * step - dot) / 2)
            for (index, letter) in letters.enumerated() {
                guard let rows = glyphs[letter] else { continue }
                for (row, line) in rows.enumerated() {
                    for (column, point) in line.enumerated() where point == "1" {
                        let rect = CGRect(x: origin.x + CGFloat(index * 6 + column) * step,
                            y: origin.y + CGFloat(row) * step, width: dot, height: dot)
                        context.fill(Path(ellipseIn: rect), with: .color(.white.opacity(0.93)))
                    }
                }
            }
        }.accessibilityLabel("百分之\(value)")
    }
}

#if DEBUG
struct FitnessWidgetPreviewView: View {
    let small: Bool
    var body: some View {
        VStack(spacing: 24) {
            FitnessWidgetView(entry: .preview, style: .gauge, previewInApp: true, previewFamily: small ? .systemSmall : .systemMedium)
                .frame(width: small ? 170 : 340, height: 170)
            FitnessWidgetView(entry: .preview, style: .ring, previewInApp: true, previewFamily: small ? .systemSmall : .systemMedium)
                .frame(width: small ? 170 : 340, height: 170)
            FitnessWidgetView(entry: .preview, style: .toggle, previewInApp: true, previewFamily: small ? .systemSmall : .systemMedium)
                .frame(width: small ? 170 : 340, height: 170)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity).background(Color.black)
    }
}
#endif
