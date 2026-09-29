import { cp, mkdir, mkdtemp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const staging = await mkdtemp(path.join(tmpdir(), "fitness-ios-release-"));
const project = path.join(staging, "ios/App/App.xcodeproj");
const archive = path.join(staging, "FitnessTracker.xcarchive");
const buildLog = path.join(staging, "archive.xcresult");
const output = path.join(root, "artifacts/ios-release");

// iCloud-managed Documents folders attach Finder metadata that codesign rejects.
// Build in local temporary storage; preserve distributable outputs in the project.
console.log(`Native build workspace: ${staging}`);
console.log(`Xcode archive log: ${buildLog}`);
await cp(path.join(root, "ios"), path.join(staging, "ios"), { recursive: true });
execFileSync("xattr", ["-cr", path.join(staging, "ios")]);
execFileSync("xcodebuild", [
  "-project", project, "-scheme", "App", "-configuration", "Release",
  "-destination", "generic/platform=iOS", "-archivePath", archive,
  "-derivedDataPath", path.join(staging, "DerivedData"), "-resultBundlePath", buildLog,
  "-scmProvider", "system",
  "CODE_SIGN_STYLE=Manual", "CODE_SIGN_IDENTITY=Apple Distribution",
  "archive"
], { stdio: "inherit" });
execFileSync("xcodebuild", [
  "-exportArchive", "-archivePath", archive, "-exportPath", path.join(staging, "export"),
  "-exportOptionsPlist", path.join(root, "ios/ExportOptions.plist")
], { stdio: "inherit" });
await mkdir(output, { recursive: true });
await cp(path.join(staging, "export/App.ipa"), path.join(output, "FitnessTracker.ipa"));
execFileSync("ditto", ["-c", "-k", "--norsrc", "--keepParent", archive, path.join(output, "FitnessTracker.xcarchive.zip")]);
console.log(`Signed IPA and archive saved to ${output}`);
