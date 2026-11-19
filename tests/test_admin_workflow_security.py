import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class GitHubOnlyAuthorizationTests(unittest.TestCase):
    def test_first_step_does_not_write_or_apply(self):
        stage = (ROOT / ".github/workflows/admin-requests.yml").read_text()
        self.assertIn("github.event.issue.user.id == 190318829", stage)
        self.assertIn("contents: read", stage)
        self.assertNotIn("contents: write", stage)
        self.assertNotIn("git push", stage)
        self.assertNotIn("scripts/admin_request.py", stage)
        self.assertIn("admin-confirm.yml", stage)

    def test_confirmation_requires_owner_identity(self):
        confirm = (ROOT / ".github/workflows/admin-confirm.yml").read_text()
        self.assertIn("workflow_dispatch:", confirm)
        self.assertIn("github.actor_id == '190318829'", confirm)
        self.assertIn("github.triggering_actor == github.actor", confirm)
        self.assertIn("AMARYT_ISSUE_PATH:", confirm)
        self.assertNotIn("GITHUB_EVENT_PATH:", confirm)
        self.assertIn("python3 scripts/admin_request.py", confirm)
        self.assertIn("gh issue close", confirm)

    def test_dashboard_makes_second_step_explicit(self):
        html = (ROOT / "admin/index.html").read_text()
        js = (ROOT / "admin/app.js").read_text()
        self.assertIn("GitHub Actions", html)
        self.assertIn("Run workflow", js)
        self.assertIn("github.com", js)

if __name__ == "__main__":
    unittest.main()
