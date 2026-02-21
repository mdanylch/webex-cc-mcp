"""
Webex Contact Center API client.
Base URL and auth from env or per-request overrides (e.g. from chat UI).
"""

import os

import httpx

DEFAULT_BASE = "https://api.wxcc-us1.cisco.com"


def get_base_url() -> str:
    return os.environ.get("CONTACT_CENTER_BASE_URL") or os.environ.get("WEBEX_CC_BASE_URL") or DEFAULT_BASE


def get_access_token() -> str:
    return os.environ.get("CONTACT_CENTER_ACCESS_TOKEN") or os.environ.get("WEBEX_CC_ACCESS_TOKEN") or ""


def get_org_id() -> str:
    return os.environ.get("CONTACT_CENTER_ORG_ID") or os.environ.get("WEBEX_CC_ORG_ID") or ""


def cc_rest(
    method: str,
    path: str,
    body: dict | None = None,
    overrides: dict | None = None,
    extra_headers: dict | None = None,
) -> dict:
    """Call Webex Contact Center REST API. Returns { ok, data?, error?, status? }."""
    overrides = overrides or {}
    base = get_base_url().rstrip("/") + "/"
    token = overrides.get("token") or get_access_token()
    if not token:
        return {"ok": False, "error": "Missing access token. Set it in the Chat tab or in server .env."}
    url = path if path.startswith("http") else base + path.lstrip("/")
    org_id = overrides.get("orgId") or get_org_id()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if org_id:
        headers["Organization-Id"] = org_id
    if extra_headers:
        headers.update(extra_headers)
    try:
        with httpx.Client(timeout=30.0) as client:
            if method.upper() in ("POST", "PUT", "PATCH") and body is not None:
                resp = client.request(method, url, json=body, headers=headers)
            else:
                resp = client.request(method, url, headers=headers)
        text = resp.text
        try:
            data = resp.json() if text else None
        except Exception:
            data = text
        if not resp.is_success:
            err = data.get("message") or data.get("error") if isinstance(data, dict) else text or resp.reason_phrase
            return {"ok": False, "error": err, "status": resp.status_code, "data": data}
        return {"ok": True, "data": data, "status": resp.status_code}
    except Exception as e:
        return {"ok": False, "error": str(e)}
