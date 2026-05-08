from models.spam import features


def test_freemail_detection():
    f = features("Sample resume text", "alice@gmail.com")
    assert f["is_freemail"] == 1.0


def test_business_email():
    f = features("Sample resume text", "alice@vaivammcapital.com")
    assert f["is_freemail"] == 0.0


def test_url_count():
    f = features("See https://github.com/me and https://linkedin.com/in/me", "x@y.com")
    assert f["url_count"] == 2.0
