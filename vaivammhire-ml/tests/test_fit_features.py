from models.fit_classifier.train import engineered_features


def test_skill_overlap():
    f = engineered_features({
        "resume_skills": ["Python", "SQL", "AWS"],
        "jd_skills": ["python", "aws", "kubernetes"],
        "years_experience": 6,
        "location_match": True,
        "education_tier": 3,
    })
    assert f["skills_overlap"] == 2
    assert 0.6 < f["skills_overlap_ratio"] < 0.7
    assert f["years_experience"] == 6.0
    assert f["location_match"] == 1.0


def test_no_overlap():
    f = engineered_features({"resume_skills": ["A"], "jd_skills": ["B"], "education_tier": 1})
    assert f["skills_overlap"] == 0
    assert f["skills_overlap_ratio"] == 0.0
