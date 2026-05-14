"""Tests for grocery CRUD routes — covers the three bugs fixed in this PR:
  - Item validation used `and` instead of `or` (#3)
  - No offset parameter for pagination (#8)
  - purchase_date accepted free-text strings (#9)
"""
import pytest


# ── helpers ──────────────────────────────────────────────────────────────────

def _add(client, headers, item="Tomato", category="Vegetables",
         quantity=1.0, price=40.0, purchase_date="2024-01-15"):
    return client.post("/api/add-purchase", json={
        "item": item,
        "category": category,
        "quantity": quantity,
        "price": price,
        "purchase_date": purchase_date,
    }, headers=headers)


# ── item validation (#3: `and` → `or`) ──────────────────────────────────────

class TestItemValidation:
    def test_valid_catalog_item_accepted(self, client, auth_headers):
        resp = _add(client, auth_headers)
        assert resp.status_code == 201

    def test_unknown_item_with_valid_category_rejected(self, client, auth_headers):
        """Before the fix, `and` let this through when the category was valid."""
        resp = _add(client, auth_headers, item="Durian", category="Vegetables")
        assert resp.status_code == 400
        assert "Unknown item" in resp.json()["detail"]

    def test_unknown_item_with_invalid_category_rejected(self, client, auth_headers):
        resp = _add(client, auth_headers, item="Durian", category="Candy")
        assert resp.status_code == 400

    def test_known_item_with_wrong_category_rejected(self, client, auth_headers):
        resp = _add(client, auth_headers, item="Tomato", category="Dairy")
        assert resp.status_code == 400


# ── pagination offset (#8) ───────────────────────────────────────────────────

class TestPagination:
    def test_offset_zero_returns_all(self, client, auth_headers):
        for i in range(3):
            _add(client, auth_headers, quantity=float(i + 1))
        resp = client.get("/api/purchases?limit=10&offset=0", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_offset_skips_records(self, client, auth_headers):
        for i in range(5):
            _add(client, auth_headers, quantity=float(i + 1))
        resp = client.get("/api/purchases?limit=10&offset=3", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_offset_beyond_total_returns_empty(self, client, auth_headers):
        _add(client, auth_headers)
        resp = client.get("/api/purchases?limit=10&offset=100", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_negative_offset_rejected(self, client, auth_headers):
        resp = client.get("/api/purchases?offset=-1", headers=auth_headers)
        assert resp.status_code == 422

    def test_limit_above_500_rejected(self, client, auth_headers):
        resp = client.get("/api/purchases?limit=501", headers=auth_headers)
        assert resp.status_code == 422


# ── purchase_date validation (#9) ────────────────────────────────────────────

class TestPurchaseDateValidation:
    def test_valid_iso_date_accepted(self, client, auth_headers):
        resp = _add(client, auth_headers, purchase_date="2024-03-15")
        assert resp.status_code == 201

    def test_free_text_date_rejected(self, client, auth_headers):
        """Before the fix, `str` type accepted "yesterday" silently."""
        resp = _add(client, auth_headers, purchase_date="yesterday")
        assert resp.status_code == 422

    def test_invalid_date_format_rejected(self, client, auth_headers):
        resp = _add(client, auth_headers, purchase_date="15-03-2024")
        assert resp.status_code == 422

    def test_impossible_date_rejected(self, client, auth_headers):
        resp = _add(client, auth_headers, purchase_date="2024-02-31")
        assert resp.status_code == 422


# ── ownership isolation ──────────────────────────────────────────────────────

class TestOwnership:
    def test_user_only_sees_own_purchases(self, client, auth_headers):
        # User A adds a purchase
        _add(client, auth_headers)

        # User B signs up and checks purchases
        r = client.post("/api/auth/signup", json={
            "name": "B", "email": "b@example.com", "password": "pass123"
        })
        token_b = r.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        resp = client.get("/api/purchases", headers=headers_b)
        assert resp.json() == []

    def test_delete_other_users_purchase_returns_404(self, client, auth_headers):
        _add(client, auth_headers)
        purchases = client.get("/api/purchases", headers=auth_headers).json()
        purchase_id = purchases[0]["id"]

        r = client.post("/api/auth/signup", json={
            "name": "B", "email": "b@example.com", "password": "pass123"
        })
        token_b = r.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        resp = client.delete(f"/api/purchases/{purchase_id}", headers=headers_b)
        assert resp.status_code == 404
