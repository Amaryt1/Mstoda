#!/usr/bin/env python3
"""Apply owner-authorized AMARYT Admin requests sent through GitHub Issues.

No user-controlled shell commands, paths or repository URLs are executed.
The GitHub workflow checks the author ID before granting write permissions;
we repeat that check here as defense in depth.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

REPO = "Amaryt1/Mstoda"
OWNER_ID = 190318829
MARKER = "<!-- AMARYT_ADMIN_REQUEST_V1 -->"
ALLOWED_FIELDS = {
    "name", "subtitle", "bundleIdentifier", "developerName", "category",
    "localizedDescription", "iconURL", "bannerURL", "tintColor", "sortOrder",
    "screenshotURLs",
}
TEXT_LIMITS = {
    "name": 160, "subtitle": 350, "bundleIdentifier": 240,
    "developerName": 160, "category": 100, "localizedDescription": 12000,
    "iconURL": 2048, "bannerURL": 2048, "tintColor": 9,
}
BUNDLE_RE = re.compile(r"^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$")
OPS = {
    "add", "update", "hide", "show", "delete", "move",
    "bulk_hide", "bulk_show", "bulk_delete", "bulk_category",
}


class InvalidRequest(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InvalidRequest(message)


def valid_https(value, field):
    require(isinstance(value, str) and len(value) <= 2048, f"{field}: رابط غير صالح")
    parsed = urlparse(value)
    require(parsed.scheme == "https" and parsed.hostname and not parsed.username and
            not parsed.password and not any(c.isspace() for c in value),
            f"{field}: يجب استخدام رابط HTTPS مباشر")
    return value


def validate_fields(fields):
    require(isinstance(fields, dict) and set(fields) <= ALLOWED_FIELDS,
            "حقول التطبيق غير مسموحة")
    clean = {}
    for key, value in fields.items():
        if key == "screenshotURLs":
            require(isinstance(value, list) and len(value) <= 5,
                    "الحد الأقصى خمس صور للعرض")
            clean[key] = [valid_https(item, "screenshotURLs") for item in value]
        elif key == "sortOrder":
            require(type(value) is int and 0 <= value <= 999999,
                    "قيمة الترتيب يجب أن تكون عددًا صحيحًا من 0 إلى 999999")
            clean[key] = value
        else:
            require(isinstance(value, str) and len(value) <= TEXT_LIMITS[key],
                    f"{key}: نوع أو طول غير صالح")
            value = value.strip()
            if key == "bundleIdentifier":
                require(bool(BUNDLE_RE.fullmatch(value)), "Bundle ID غير صالح")
            if key in ("iconURL", "bannerURL") and value:
                valid_https(value, key)
            if key == "tintColor" and value:
                require(bool(re.fullmatch(r"#?[0-9a-fA-F]{6}", value)),
                        "لون البطاقة يجب أن يكون HEX من ست خانات")
                value = value.lstrip("#")
            clean[key] = value
    return clean


def validate_release(release):
    if release is None:
        return None
    require(isinstance(release, dict) and set(release) <=
            {"version", "downloadURL", "localizedDescription"}, "بيانات الإصدار غير صالحة")
    version = release.get("version", "")
    url = release.get("downloadURL", "")
    notes = release.get("localizedDescription", "")
    require(isinstance(version, str) and 0 < len(version.strip()) <= 90,
            "رقم الإصدار مطلوب")
    require(isinstance(notes, str) and len(notes) <= 6000,
            "ملاحظات الإصدار طويلة جدًا")
    valid_https(url, "downloadURL")
    return {"version": version.strip(), "downloadURL": url.strip(),
            "localizedDescription": notes.strip(),
            "date": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")}


def parse_issue(event, repository):
    require(repository == REPO, "مستودع غير مصرح به")
    issue = event.get("issue") or {}
    require(issue.get("state", "open") == "open", "الطلب مغلق أو تم تنفيذه سابقًا")
    require((issue.get("user") or {}).get("id") == OWNER_ID, "مالك الحساب فقط يستطيع الإدارة")
    require(not issue.get("pull_request"), "لا نعالج طلبات الدمج")
    body = issue.get("body") or ""
    require(isinstance(body, str) and len(body) <= 65000, "طلب طويل جدًا")
    fence = chr(96) * 3
    pattern = (r"\s*" + re.escape(MARKER) + r"\s*" +
               re.escape(fence + "json") + r"\s*(.*?)\s*" +
               re.escape(fence) + r"\s*")
    match = re.fullmatch(pattern, body, re.S)
    require(bool(match), "هذا الطلب ليس طلب AMARYT Admin صالحًا")
    try:
        data = json.loads(match.group(1))
    except (ValueError, TypeError) as exc:
        raise InvalidRequest("بيانات JSON غير صالحة") from exc
    require(isinstance(data, dict) and data.get("schema") == 1, "نسخة الطلب غير مدعومة")
    require(data.get("operation") in OPS, "عملية غير معروفة")
    return data


def normalize_order(items):
    items.sort(key=lambda a: (a.get("sortOrder", 1000000), a.get("name", "").casefold()))


def find_in(data, identifier):
    matches = [(data[k], i, app) for k in ("apps", "hiddenApps")
               for i, app in enumerate(data[k]) if app.get("bundleIdentifier") == identifier]
    require(len(matches) < 2, "معرف التطبيق مكرر في قاعدة البيانات")
    require(bool(matches), f"التطبيق غير موجود: {identifier}")
    return matches[0]


def apply_fields(app, fields, updating=False):
    fields = validate_fields(fields)
    for k, value in fields.items():
        if value == "" and updating and k not in ("name", "bundleIdentifier"):
            app.pop(k, None)
        elif value != "" or k in ("name", "bundleIdentifier"):
            app[k] = value
    require(isinstance(app.get("name"), str) and bool(app["name"].strip()),
            "اسم التطبيق مطلوب")
    require(isinstance(app.get("bundleIdentifier"), str) and
            bool(BUNDLE_RE.fullmatch(app["bundleIdentifier"])), "Bundle ID مطلوب")
    return app


def unique_ids(data):
    identifiers = [a.get("bundleIdentifier") for a in data["apps"] + data["hiddenApps"]]
    require(len(identifiers) == len(set(identifiers)), "يوجد Bundle ID مكرر")


def validate_catalog(data):
    unique_ids(data)
    for app in data["apps"]:
        require(bool(app.get("name")), "تطبيق منشور بدون اسم")
        require(bool(app.get("versions")), "لا يمكن نشر تطبيق بدون إصدار")
        for version in app["versions"]:
            valid_https(version.get("downloadURL"), "downloadURL")
        validate_fields({k: app[k] for k in ALLOWED_FIELDS if k in app})
    for app in data["hiddenApps"]:
        validate_fields({k: app[k] for k in ALLOWED_FIELDS if k in app})


def apply(data, request):
    require(isinstance(data, dict) and isinstance(data.get("apps"), list),
            "قاعدة التطبيقات غير صالحة")
    data.setdefault("hiddenApps", [])
    require(isinstance(data["hiddenApps"], list), "قائمة التطبيقات المخفية غير صالحة")
    op = request["operation"]
    identifier = request.get("target")
    if op == "add":
        fields = validate_fields(request.get("fields", {}))
        require("name" in fields and "bundleIdentifier" in fields,
                "الاسم وBundle ID مطلوبان للإضافة")
        all_ids = {a.get("bundleIdentifier") for a in data["apps"] + data["hiddenApps"]}
        require(fields["bundleIdentifier"] not in all_ids, "هذا التطبيق موجود مسبقًا")
        app = apply_fields({"versions": [], "screenshotURLs": []}, fields)
        release = validate_release(request.get("release"))
        if release:
            app["versions"].append(release)
        hidden = request.get("hidden", False)
        require(type(hidden) is bool, "حالة النشر غير صحيحة")
        require(hidden or app["versions"], "أضف إصدارًا قبل النشر أو احفظه كمسودة مخفية")
        data["hiddenApps" if hidden else "apps"].append(app)
    elif op in ("update", "hide", "show", "delete", "move"):
        require(isinstance(identifier, str) and bool(BUNDLE_RE.fullmatch(identifier)),
                "معرّف التطبيق المستهدف غير صالح")
        collection, index, app = find_in(data, identifier)
        if op == "update":
            apply_fields(app, request.get("fields", {}), updating=True)
            release = validate_release(request.get("release"))
            if release:
                versions = app.setdefault("versions", [])
                versions[:] = [v for v in versions if v.get("version") != release["version"]]
                versions.insert(0, release)
            if collection is data["apps"]:
                require(bool(app.get("versions")), "التطبيق المنشور يحتاج إصدارًا")
        elif op == "hide":
            require(collection is data["apps"], "التطبيق مخفي بالفعل")
            data["hiddenApps"].append(collection.pop(index))
        elif op == "show":
            require(collection is data["hiddenApps"], "التطبيق منشور بالفعل")
            require(bool(app.get("versions")), "أضف إصدارًا قبل إظهار التطبيق")
            data["apps"].append(collection.pop(index))
        elif op == "delete":
            collection.pop(index)
        elif op == "move":
            require(collection is data["apps"], "لا يمكن ترتيب تطبيق مخفي")
            direction = request.get("direction")
            require(direction in ("up", "down"), "اتجاه الترتيب غير معروف")
            normalize_order(collection)
            position = next(i for i, item in enumerate(collection) if item is app)
            next_position = position + (-1 if direction == "up" else 1)
            require(0 <= next_position < len(collection), "التطبيق على طرف القائمة بالفعل")
            collection[position], collection[next_position] = collection[next_position], collection[position]
            for i, item in enumerate(collection):
                item["sortOrder"] = (i + 1) * 10
    else:
        targets = request.get("targets")
        require(isinstance(targets, list) and 1 <= len(targets) <= 100 and
                len(targets) == len(set(targets)), "حدد من 1 إلى 100 تطبيق مختلف")
        for target in targets:
            require(isinstance(target, str) and bool(BUNDLE_RE.fullmatch(target)),
                    "معرف ضمن الاختيار المتعدد غير صالح")
        for target in targets:
            collection, index, app = find_in(data, target)
            if op == "bulk_hide":
                require(collection is data["apps"], "تم اختيار تطبيق مخفي")
                data["hiddenApps"].append(collection.pop(index))
            elif op == "bulk_show":
                require(collection is data["hiddenApps"] and bool(app.get("versions")),
                        "لا يمكن إظهار تطبيق بلا إصدار")
                data["apps"].append(collection.pop(index))
            elif op == "bulk_delete":
                collection.pop(index)
            elif op == "bulk_category":
                category = request.get("category")
                require(isinstance(category, str) and 0 < len(category.strip()) <= 100,
                        "الفئة الجديدة غير صالحة")
                app["category"] = category.strip()
    normalize_order(data["apps"])
    normalize_order(data["hiddenApps"])
    validate_catalog(data)
    return data


def main():
    try:
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
        request = parse_issue(event, os.environ.get("GITHUB_REPOSITORY", ""))
        path = Path("apps.json")
        data = json.loads(path.read_text(encoding="utf-8"))
        apply(data, request)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"AMARYT Admin applied {request['operation']} from owner issue.")
    except (InvalidRequest, ValueError, KeyError, OSError, TypeError) as exc:
        print(f"AMARYT Admin rejected request: {exc}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
