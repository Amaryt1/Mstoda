import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from admin_request import update_store, InvalidRequest

class StoreUpdateTests(unittest.TestCase):
    def setUp(self):
        self.doc = dict(schema=1, revision=0, current=None, previous=None)
        self.release = dict(version="2.10", build="4", mandatory=True, notes="test",
                            url="https://github.com/Amaryt1/Feather/releases/download/v2.10/store.ipa")
    def publish(self):
        return update_store(self.doc, dict(mode="publish", revision=0, release=self.release), lambda *args: "a"*64)
    def test_publish_pause_rollback(self):
        published = self.publish()
        self.assertEqual(published["current"]["sha256"], "a"*64)
        paused = update_store(published, dict(mode="pause", revision=1))
        self.assertFalse(paused["current"]["mandatory"])
        self.assertEqual(update_store(paused, dict(mode="rollback", revision=2))["current"], published["current"])
        self.assertIsNone(update_store(published, dict(mode="rollback", revision=1))["current"])
    def test_stale(self):
        with self.assertRaises(InvalidRequest): update_store(self.publish(), dict(mode="pause", revision=0))
    def test_invalid(self):
        for key, value in [("url", "https://other.test/app.ipa"), ("version", "2.x"), ("build", "-5"), ("mandatory", "false")]:
            with self.subTest(key=key):
                old = self.release[key]
                self.release[key] = value
                with self.assertRaises(InvalidRequest): self.publish()
                self.release[key] = old
