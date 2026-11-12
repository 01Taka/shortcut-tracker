const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
const PACKAGE_LOCK_PATH = path.join(ROOT_DIR, "package-lock.json");
const VSIX_DIR = path.join(ROOT_DIR, "vsix");

/**
 * パッチバージョンをインクリメントした新しいバージョン文字列を返す
 */
function bumpPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(version);
  if (!match) {
    throw new Error(`サポートされていないバージョン形式です: ${version}`);
  }
  const major = match[1];
  const minor = match[2];
  const patch = Number(match[3]) + 1;
  const suffix = match[4] || "";
  return `${major}.${minor}.${patch}${suffix}`;
}

/**
 * package.json / package-lock.json の version を更新する
 */
function updateVersionFiles(newVersion) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
  pkg.version = newVersion;
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(pkg, null, 2) + "\n",
    "utf-8",
  );

  if (fs.existsSync(PACKAGE_LOCK_PATH)) {
    const lock = JSON.parse(fs.readFileSync(PACKAGE_LOCK_PATH, "utf-8"));
    lock.version = newVersion;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = newVersion;
    }
    fs.writeFileSync(
      PACKAGE_LOCK_PATH,
      JSON.stringify(lock, null, 2) + "\n",
      "utf-8",
    );
  }
}

function run() {
  fs.mkdirSync(VSIX_DIR, { recursive: true });

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
  const initialVersion = pkg.version;
  let targetVersion = initialVersion;

  while (
    fs.existsSync(path.join(VSIX_DIR, `${pkg.name}-${targetVersion}.vsix`))
  ) {
    targetVersion = bumpPatchVersion(targetVersion);
  }

  if (targetVersion !== initialVersion) {
    console.log(
      `既存の ${pkg.name}-${initialVersion}.vsix が見つかったため、バージョンを ${initialVersion} -> ${targetVersion} に自動更新します。`,
    );
    updateVersionFiles(targetVersion);
  }

  execSync("vsce package --out vsix/", {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
}

run();
