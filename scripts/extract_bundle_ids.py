import json, plistlib, re, tempfile, urllib.request, zipfile
from pathlib import Path

release_url = "https://github.com/Amaryt1/Mstoda/releases/download/1.0/"
files = [
    ("iQFace", "iQFace_1.2.ipa", "1.2"),
    ("iQGram", "iQGram_1.3.ipa", "1.3"),
    ("iQSwift", "iQSwift_1.5.ipa", "1.5"),
    ("iQTele", "iQTele_1.5.ipa", "1.5"),
    ("iQTube", "iQTube_1.3.ipa", "1.3"),
    ("iQTv", "iQTv.ipa", "1.1"),
    ("كملنا VIP", "Kammelna-3.11.0-k7balot.ipa", "3.11.0"),
]
results = []
for name, filename, expected in files:
    req = urllib.request.Request(release_url + filename, headers={"User-Agent": "AMARYT-STORE"})
    with urllib.request.urlopen(req, timeout=180) as response, tempfile.NamedTemporaryFile(suffix=".ipa") as tmp:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        tmp.flush()
        with zipfile.ZipFile(tmp.name) as archive:
            plist_paths = [p for p in archive.namelist() if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", p)]
            if len(plist_paths) != 1:
                raise RuntimeError(f"{name}: expected one app Info.plist, found {len(plist_paths)}")
            info = plistlib.loads(archive.read(plist_paths[0]))
            results.append({
                "name": name,
                "file": filename,
                "expectedVersion": expected,
                "bundleIdentifier": info.get("CFBundleIdentifier"),
                "shortVersion": str(info.get("CFBundleShortVersionString", "")),
                "buildVersion": str(info.get("CFBundleVersion", "")),
                "displayName": info.get("CFBundleDisplayName") or info.get("CFBundleName"),
                "versionMatches": str(info.get("CFBundleShortVersionString", "")) == expected
            })
            print(f"{name}: {results[-1]['bundleIdentifier']} / {results[-1]['shortVersion']} (expected {expected})")
if any(not x["bundleIdentifier"] for x in results):
    raise RuntimeError("At least one IPA has no CFBundleIdentifier")
if len({x["bundleIdentifier"] for x in results}) != len(results):
    raise RuntimeError("Duplicate bundle identifiers found")
Path("metadata").mkdir(exist_ok=True)
Path("metadata/bundle-identifiers.json").write_text(json.dumps({"release":"1.0","apps":results}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
