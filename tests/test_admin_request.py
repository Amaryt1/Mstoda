import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import admin_request as admin


def seed():
    return {"name": "AMARYT STORE", "apps": [
        {"name": "First", "bundleIdentifier": "com.example.first",
         "versions": [{"version": "1.0", "date": "2026-01-01T00:00:00Z",
                       "downloadURL": "https://example.com/first.ipa"}],
         "screenshotURLs": [], "sortOrder": 10},
        {"name": "Second", "bundleIdentifier": "com.example.second",
         "versions": [{"version": "1.0", "date": "2026-01-01T00:00:00Z",
                       "downloadURL": "https://example.com/second.ipa"}],
         "sortOrder": 20}
    ], "hiddenApps": []}


class AdminRequestTests(unittest.TestCase):
    def issue(self, author=admin.OWNER_ID, op="hide", **extras):
        body = "<!-- AMARYT_ADMIN_REQUEST_V1 -->\n" + chr(96)*3 + "json\n"
        body += json.dumps({"schema": 1, "operation": op,
                            "target": "com.example.first", **extras})
        body += "\n" + chr(96)*3
        return {"state": "open", "user": {"id": author}, "body": body}

    def test_manual_dispatch_and_issue_have_independent_identities(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as directory:
            path = Path(directory) / "issue.json"
            env = dict(GITHUB_EVENT_NAME="workflow_dispatch", GITHUB_REF="refs/heads/main",
                       GITHUB_ACTOR_ID=str(admin.OWNER_ID), GITHUB_ACTOR="Amaryt1",
                       GITHUB_TRIGGERING_ACTOR="Amaryt1", GITHUB_REPOSITORY=admin.REPO,
                       ISSUE_NUMBER="6", AMARYT_ISSUE_PATH=str(path))
            issue = dict(self.issue(), number=6, repository_url="https://api.github.com/repos/" + admin.REPO)
            path.write_text(json.dumps(issue))
            self.assertEqual(admin.confirmed_request(env)["operation"], "hide")
            for key, value in [("GITHUB_ACTOR_ID", "123"), ("GITHUB_TRIGGERING_ACTOR", "another-user"),
                               ("GITHUB_ACTOR_ID", ""), ("GITHUB_EVENT_NAME", "issues"),
                               ("ISSUE_NUMBER", "7"), ("GITHUB_REF", "refs/heads/test")]:
                with self.subTest(key=key, value=value), self.assertRaises(admin.InvalidRequest):
                    admin.confirmed_request(dict(env, **{key: value}))
            for patch in [dict(user={"id": 123}), dict(state="closed"), dict(state=None),
                          dict(pull_request={}), dict(repository_url="https://example.org")]:
                path.write_text(json.dumps(dict(issue, **patch)))
                with self.subTest(patch=patch), self.assertRaises(admin.InvalidRequest):
                    admin.confirmed_request(env)

    def test_owner_issue_is_accepted(self):
        request = admin.parse_issue(self.issue(), admin.REPO)
        self.assertEqual(request["operation"], "hide")

    def test_non_owner_issue_rejected(self):
        with self.assertRaises(admin.InvalidRequest):
            admin.parse_issue(self.issue(author=999), admin.REPO)

    def test_closed_issue_rejected_to_prevent_replay(self):
        event = self.issue()
        event["state"] = "closed"
        with self.assertRaises(admin.InvalidRequest):
            admin.parse_issue(event, admin.REPO)

    def test_wrong_repo_rejected(self):
        with self.assertRaises(admin.InvalidRequest):
            admin.parse_issue(self.issue(), "other/repo")

    def test_malformed_issue_rejected(self):
        with self.assertRaises(admin.InvalidRequest):
            admin.parse_issue({"state": "open", "user": {"id": admin.OWNER_ID},
                                          "body": "please delete everything"}, admin.REPO)

    def test_hide_and_show_without_data_loss(self):
        data = seed()
        admin.apply(data, {"operation": "hide", "target": "com.example.first"})
        self.assertEqual(len(data["apps"]), 1)
        self.assertEqual(data["hiddenApps"][0]["name"], "First")
        admin.apply(data, {"operation": "show", "target": "com.example.first"})
        self.assertEqual(len(data["apps"]), 2)
        self.assertEqual(len(data["hiddenApps"]), 0)

    def test_add_edit_release_and_images(self):
        data = seed()
        admin.apply(data, {
            "operation": "add",
            "fields": {"name": "Third", "bundleIdentifier": "com.example.third",
                       "category": "Games", "screenshotURLs":
                       ["https://example.com/1.png", "https://example.com/2.png"]},
            "release": {"version": "2.1.0",
                        "downloadURL": "https://example.com/third.ipa"}
        })
        self.assertEqual(data["apps"][-1]["name"], "Third")
        admin.apply(data, {"operation": "update", "target": "com.example.third",
                           "fields": {"name": "Third Pro", "category": "Utilities"}})
        self.assertEqual(data["apps"][-1]["category"], "Utilities")
        self.assertEqual(data["apps"][-1]["versions"][0]["version"], "2.1.0")

    def test_url_with_http_rejected(self):
        with self.assertRaises(admin.InvalidRequest):
            admin.apply(seed(), {"operation": "add", "fields": {
                "name": "Danger", "bundleIdentifier": "com.example.danger",
                "iconURL": "http://example.com/icon.png"},
                "release": {"version": "1", "downloadURL": "https://example.com/app.ipa"}})

    def test_duplicate_bundle_rejected(self):
        with self.assertRaises(admin.InvalidRequest):
            admin.apply(seed(), {"operation": "add", "fields": {
                "name": "Duplicate", "bundleIdentifier": "com.example.first"},
                "release": {"version": "1", "downloadURL": "https://example.com/app.ipa"}})

    def test_draft_must_be_hidden_if_no_release(self):
        data = seed()
        admin.apply(data, {"operation": "add", "hidden": True, "fields": {
            "name": "Draft", "bundleIdentifier": "com.example.draft"}})
        self.assertEqual(data["hiddenApps"][0]["name"], "Draft")
        with self.assertRaises(admin.InvalidRequest):
            admin.apply(data, {"operation": "show", "target": "com.example.draft"})

    def test_move_updates_order(self):
        data = seed()
        admin.apply(data, {"operation": "move", "target": "com.example.second", "direction": "up"})
        self.assertEqual(data["apps"][0]["name"], "Second")

    def test_bulk_category_and_hide(self):
        data = seed()
        ids = ["com.example.first", "com.example.second"]
        admin.apply(data, {"operation": "bulk_category", "targets": ids,
                           "category": "ألعاب"})
        self.assertTrue(all(a["category"] == "ألعاب" for a in data["apps"]))
        admin.apply(data, {"operation": "bulk_hide", "targets": ids})
        self.assertEqual(len(data["apps"]), 0)
        self.assertEqual(len(data["hiddenApps"]), 2)

    def test_preserves_other_catalog_keys(self):
        data = seed()
        data["news"] = [{"title": "Unchanged"}]
        before = copy.deepcopy(data["news"])
        admin.apply(data, {"operation": "update", "target": "com.example.first",
                           "fields": {"subtitle": "Hello"}})
        self.assertEqual(data["news"], before)


if __name__ == "__main__":
    unittest.main()
