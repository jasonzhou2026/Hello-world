import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var timeChangeObserver: NSObjectProtocol?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = FitnessViewController()
        window?.overrideUserInterfaceStyle = .dark
        window?.makeKeyAndVisible()

        handleWidgetURLs(connectionOptions.urlContexts)
        timeChangeObserver = NotificationCenter.default.addObserver(forName: UIApplication.significantTimeChangeNotification,
            object: nil, queue: .main) { [weak self] _ in
                FitnessWidgetStore.reloadWidgets()
                self?.notifyWidgetStateChanged()
            }
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        handleWidgetURLs(URLContexts)
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        notifyWidgetStateChanged()
    }

    private func handleWidgetURLs(_ contexts: Set<UIOpenURLContext>) {
        guard let context = contexts.first(where: { $0.url.scheme == "fitnesstracker" && ["goal", "complete-goal"].contains($0.url.host ?? "") }) else { return }
        FitnessWidgetStore.markGoalOpened()
        if context.url.host == "complete-goal" { FitnessWidgetStore.completeToday() }
        notifyWidgetStateChanged()
    }

    private func notifyWidgetStateChanged() {
        (window?.rootViewController as? FitnessViewController)?.webView?.evaluateJavaScript(
            "window.dispatchEvent(new Event('fitnessWidgetsChanged'))", completionHandler: nil)
    }

    deinit {
        if let timeChangeObserver { NotificationCenter.default.removeObserver(timeChangeObserver) }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
