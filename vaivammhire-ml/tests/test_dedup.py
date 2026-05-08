from models.dedup import CandidateKey, DedupIndex


def test_exact_email_match():
    idx = DedupIndex()
    idx.add("c1", CandidateKey(email="a@example.com", phone="9999999999", resume_text="Engineer at Acme."))
    hits = idx.query(CandidateKey(email="A@Example.com", phone=None, resume_text="Different text entirely."))
    assert "c1" in hits


def test_minhash_similar_resume():
    idx = DedupIndex(threshold=0.5)
    text = "Software engineer with 6 years experience in Python and AWS Lambda."
    idx.add("c1", CandidateKey(email="a@example.com", phone=None, resume_text=text))
    near = "Software engineer with 6 years experience in Python and AWS Lambda functions."
    hits = idx.query(CandidateKey(email="b@example.com", phone=None, resume_text=near))
    assert "c1" in hits


def test_no_match():
    idx = DedupIndex()
    idx.add("c1", CandidateKey(email="a@example.com", phone=None, resume_text="apples bananas"))
    hits = idx.query(CandidateKey(email="b@example.com", phone=None, resume_text="quantum thermodynamics integrals"))
    assert hits == []
