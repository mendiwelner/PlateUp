from fastapi import status

from app.core.deps import get_current_user


def test_health_and_ingredients(api_client):
    client, _ = api_client

    health = client.get("/health")
    ingredients = client.get("/api/ai/ingredients")

    assert health.status_code == status.HTTP_200_OK
    assert health.json() == {"status": "ok"}
    assert ingredients.status_code == status.HTTP_200_OK
    assert isinstance(ingredients.json(), dict)
    assert ingredients.json()


def test_planner_starts_empty_and_round_trips(api_client):
    client, _ = api_client

    initial = client.get("/api/planner/me")
    assert initial.status_code == status.HTTP_200_OK
    assert initial.json()["selected_recipe_ids"] == []
    assert initial.json()["schedule"] == {}
    assert initial.json()["updated_at"] is None

    payload = {
        "selected_recipe_ids": ["teriyaki-chicken", "lentil-sweet-potato"],
        "schedule": {"2026-11-02": ["teriyaki-chicken"]},
    }
    saved = client.put("/api/planner/me", json=payload)
    loaded = client.get("/api/planner/me")

    assert saved.status_code == status.HTTP_200_OK
    assert saved.json()["selected_recipe_ids"] == payload["selected_recipe_ids"]
    assert saved.json()["schedule"] == payload["schedule"]
    assert saved.json()["updated_at"] is not None
    assert loaded.json()["selected_recipe_ids"] == payload["selected_recipe_ids"]
    assert loaded.json()["schedule"] == payload["schedule"]


def test_planner_data_is_isolated_per_user(api_client):
    client, active_user_id = api_client
    first_user_payload = {
        "selected_recipe_ids": ["teriyaki-chicken"],
        "schedule": {"2026-11-02": ["teriyaki-chicken"]},
    }
    client.put("/api/planner/me", json=first_user_payload)

    active_user_id["value"] = 2
    second_user_initial = client.get("/api/planner/me")
    assert second_user_initial.json()["selected_recipe_ids"] == []
    assert second_user_initial.json()["schedule"] == {}

    second_user_payload = {"selected_recipe_ids": ["shakshuka"], "schedule": {}}
    client.put("/api/planner/me", json=second_user_payload)

    active_user_id["value"] = 1
    first_user_loaded = client.get("/api/planner/me")
    assert first_user_loaded.json()["selected_recipe_ids"] == first_user_payload["selected_recipe_ids"]
    assert first_user_loaded.json()["schedule"] == first_user_payload["schedule"]


def test_planner_rejects_invalid_date(api_client):
    client, _ = api_client

    response = client.put(
        "/api/planner/me",
        json={"selected_recipe_ids": [], "schedule": {"02-11-2026": ["shakshuka"]}},
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_planner_requires_authentication(api_client):
    client, _ = api_client
    client.app.dependency_overrides.pop(get_current_user)

    response = client.get("/api/planner/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
