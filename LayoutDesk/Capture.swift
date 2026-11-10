import Cocoa
import Carbon
import Network

// Register the second letter only while waiting for it and the first letter only during an armed session.
final class Helper: NSObject, NSApplicationDelegate {
    // Personalize only the development plugin next to this copy of the helper.
    func configurePlugin() throws {
        let folder = Bundle.main.bundleURL.deletingLastPathComponent()
        let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("manifest.json"))) as? [String: Any]
        guard manifest?["id"] as? String == "1583295627041910359",
              manifest?["main"] as? String == "code.js" else { throw CocoaError(.fileReadCorruptFile) }
        let file = folder.appendingPathComponent("code.js")
        let script = try String(contentsOf: file, encoding: .utf8)
        let prefix = "const localCaptureKey = "
        guard script.hasPrefix(prefix), let end = script.firstIndex(of: "\n") else { throw CocoaError(.fileReadCorruptFile) }
        let header = prefix + "\"" + key + "\""
        if script[..<end] != header {
            try (header + script[end...]).write(to: file, atomically: true, encoding: .utf8)
        }
    }
    func application(_ application: NSApplication, open urls: [URL]) {
        // Launch Services also delivers this event when the helper is already running.
    }
    var item: NSStatusItem!
    var listener: NWListener!
    var client: NWConnection?
    var zKey: EventHotKeyRef?
    var aKey: EventHotKeyRef?
    var nextLetter: DispatchWorkItem?
    var target: NSRunningApplication?
    var originTab: AXUIElement?
    var originWindow: AXUIElement?
    func rememberOrigin(){
        target = NSWorkspace.shared.frontmostApplication
        originTab = nil
        originWindow = nil
        guard let app = target, app.bundleIdentifier?.lowercased() == "com.figma.desktop", AXIsProcessTrusted() else { return }
        let ax = AXUIElementCreateApplication(app.processIdentifier)
        var window: CFTypeRef?
        guard AXUIElementCopyAttributeValue(ax, kAXFocusedWindowAttribute as CFString, &window) == .success, let value = window else { return }
        let focused = value as! AXUIElement
        originWindow = focused
        var queue = [focused], index = 0
        while index < queue.count && index < 250 {
            let node = queue[index]; index += 1
            var role: CFTypeRef?, selected: CFTypeRef?, children: CFTypeRef?
            AXUIElementCopyAttributeValue(node,kAXRoleAttribute as CFString,&role)
            if role as? String == "AXRadioButton" || role as? String == "AXTab" {
                AXUIElementCopyAttributeValue(node,kAXValueAttribute as CFString,&selected)
                if (selected as? NSNumber)?.boolValue == true { originTab = node; break }
            }
            AXUIElementCopyAttributeValue(node,kAXChildrenAttribute as CFString,&children)
            if let nodes = children as? [AXUIElement] { queue.append(contentsOf: nodes.prefix(50)) }
        }
    }
    func returnToOrigin(){
        target?.activate(options: [.activateAllWindows])
        if let window = originWindow { AXUIElementPerformAction(window,kAXRaiseAction as CFString) }
        if let tab = originTab { AXUIElementPerformAction(tab,kAXPressAction as CFString) }
    }
    var process: Process?
    let key: String = {
        let defaults = UserDefaults.standard
        if let saved = defaults.string(forKey: "pairing") { return saved }
        let value = UUID().uuidString
        defaults.set(value, forKey: "pairing")
        return value
    }()
    func applicationDidFinishLaunching(_ notification: Notification) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "排版台"
        let menu = NSMenu()
        let status = menu.addItem(withTitle: "正在连接排版台…", action: nil, keyEquivalent: "")
        do {
            try configurePlugin()
            status.title = "截图助手已就绪"
        } catch {
            status.title = "请将助手和插件一起放在可写文件夹中"
        }
        menu.addItem(withTitle: "退出截图助手", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        item.menu = menu
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, event, ptr in
            guard let event = event, let ptr = ptr else { return OSStatus(eventNotHandledErr) }
            var id = EventHotKeyID()
            GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &id)
            Unmanaged<Helper>.fromOpaque(ptr).takeUnretainedValue().pressed(id.id)
            return noErr
        }, 1, &spec, Unmanaged.passUnretained(self).toOpaque(), nil)
        let options = NWParameters.tcp
        options.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 48371)
        options.defaultProtocolStack.applicationProtocols.insert(NWProtocolWebSocket.Options(), at: 0)
        do {
            listener = try NWListener(using: options)
            listener.newConnectionHandler = { [weak self] connection in
                connection.start(queue: .main)
                self?.receive(connection, authenticated: false)
                DispatchQueue.main.asyncAfter(deadline: .now()+5) { if self?.client !== connection { connection.cancel() } }
            }
            listener.stateUpdateHandler = { [weak self] state in
                if case .failed = state { self?.item.button?.title = "截图助手端口不可用" }
            }
            listener.start(queue: .main)
        } catch { item.button?.title = "截图助手启动失败" }
    }
    func send(_ text: String) {
        transmit(Data(text.utf8), type: .text)
    }
    func transmit(_ data: Data, type: NWProtocolWebSocket.Opcode) {
        let metadata = NWProtocolWebSocket.Metadata(opcode: type)
        let context = NWConnection.ContentContext(identifier: "shot", metadata: [metadata])
        client?.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { _ in })
    }
    func receive(_ c: NWConnection, authenticated: Bool) {
        c.receiveMessage { [weak self] bytes, _, _, error in
            guard let self = self else { return }
            guard error == nil, let bytes = bytes, bytes.count < 128, let message = String(data: bytes, encoding: .utf8) else {
                if self.client === c { self.reset(); self.client = nil }
                c.cancel(); return
            }
            if !authenticated {
                guard message == self.key else { c.cancel(); return }
                self.reset()
                self.client?.cancel()
                self.client = c
                self.send("ready")
            } else if self.client === c {
                if message == "arm" {
                    self.reset()
                    self.rememberOrigin()
                    if self.register(UInt32(kVK_ANSI_Z), id: 1, ref: &self.zKey) { self.send("armed") }
                    else { self.send("shortcut-unavailable") }
                } else if message == "captureNow" {
                    self.rememberOrigin()
                    self.capture()
                } else if message == "capture" { self.capture() }
                else if message == "cancel" { self.reset() }
            } else { c.cancel(); return }
            self.receive(c, authenticated: true)
        }
    }
    func register(_ code: UInt32, id: UInt32, ref: inout EventHotKeyRef?) -> Bool {
        RegisterEventHotKey(code, UInt32(shiftKey), EventHotKeyID(signature: 0x4c44534b, id: id), GetApplicationEventTarget(), 0, &ref) == noErr
    }
    func clearLetters() {
        nextLetter?.cancel()
        if let key = aKey { UnregisterEventHotKey(key); aKey = nil }
        if let key = zKey { UnregisterEventHotKey(key); zKey = nil }
    }
    func reset() {
        clearLetters()
        if let p = process, p.isRunning { p.terminate() }
        process = nil
    }
    func pressed(_ id: UInt32) {
        if id == 2 && aKey != nil { capture(); return }
        guard id == 1, zKey != nil else { return }
        if aKey == nil && !register(UInt32(kVK_ANSI_A), id: 2, ref: &aKey) { send("shortcut-unavailable"); return }
        nextLetter?.cancel()
        let expiry = DispatchWorkItem { [weak self] in
            if let key = self?.aKey { UnregisterEventHotKey(key); self?.aKey = nil }
        }
        nextLetter = expiry
        DispatchQueue.main.asyncAfter(deadline: .now()+1.2, execute: expiry)
    }
    func capture() {
        guard process == nil else { return }
        clearLetters()
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".png")
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        p.arguments = ["-i", "-x", "-s", "-t", "png", file.path]
        process = p
        p.terminationHandler = { [weak self] completed in
            DispatchQueue.main.async {
                defer { try? FileManager.default.removeItem(at: file) }
                guard let self = self, self.process === completed else { return }
                self.process = nil
                self.returnToOrigin()
                guard let data = try? Data(contentsOf: file), !data.isEmpty else { self.send("cancelled"); return }
                self.transmit(data, type: .binary)
            }
        }
        send("capturing")
        DispatchQueue.main.asyncAfter(deadline: .now()+0.25) { [weak self] in
            guard self?.process === p else { return }
            do { try p.run() } catch { self?.process = nil; self?.send("failed") }
        }
    }
}
let app = NSApplication.shared
let helper = Helper()
app.setActivationPolicy(.accessory)
app.delegate = helper
app.run()
