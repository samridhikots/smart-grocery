"""Tests for authentication routes.
  - JWT round-trip (sign up → login → /me)
  - Duplicate email rejected
  - Short password rejected
  - Wrong password rejected
  - Expired / tampered token rejected
"""
import pytest


class TestSignup:
    def test_signup_returns_token_and_user(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "secure123",
        })
        assert resp.status_code == 201
        body = resp.json()
        assert "access_token" in body
        assert body["user"]["email"] == "alice@example.com"
        assert body["user"]["onboarding_complete"] is False

    def test_duplicate_email_rejected(self, client):
        payload = {"name": "A", "email": "dup@example.com", "password": "pass123"}
        client.post("/api/auth/signup", json=payload)
        resp = client.post("/api/auth/signup", json=payload)
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"]

    def test_short_password_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "A", "email": "a@example.com", "password": "abc"
        })
        assert resp.status_code == 400

    def test_empty_name_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "  ", "email": "a@example.com", "password": "pass123"
        })
        assert resp.status_code == 400


class TestLogin:
    def test_correct_credentials_return_token(self, client):
        client.post("/api/auth/signup", json={
            "name": "Bob", "email": "bob@example.com", "password": "pass123"
        })
        resp = client.post("/api/auth/login", json={
            "email": "bob@example.com", "password": "pass123"
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_wrong_password_rejected(self, client):
        client.post("/api/auth/signup", json={
            "name": "Bob", "email": "bob@example.com", "password": "pass123"
        })
        resp = client.post("/api/auth/login", json={
            "email": "bob@example.com", "password": "wrongpass"
        })
        assert resp.status_code == 401

    def test_unknown_email_rejected(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@example.com", "password": "pass123"
        })
        assert resp.status_code == 401


class TestMe:
    def test_me_returns_current_user(self, client, auth_headers):
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"

    def test_me_without_token_returns_403(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    def test_me_with_tampered_token_rejected(self, client):
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer fake.token.here"})
        assert resp.status_code == 401


class TestOnboarding:
    def test_onboarding_updates_user(self, client, auth_headers):
        resp = client.put("/api/auth/onboarding", json={
            "household_size": 4,
            "monthly_budget": 5000.0,
            "dietary_prefs": "vegetarian",
        }, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["household_size"] == 4
        assert body["monthly_budget"] == 5000.0
        assert body["onboarding_complete"] is True

    def test_household_size_clamped_to_max(self, client, auth_headers):
        resp = client.put("/api/auth/onboarding", json={
            "household_size": 99, "monthly_budget": 3000.0
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["household_size"] <= 15
