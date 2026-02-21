"""
Chat with LLM + MCP tools: user prompt -> LLM decides tool calls -> we execute on MCP server -> return reply.
Supports Claude (ANTHROPIC_API_KEY / CLAUDE_API_KEY) or OpenAI (OPENAI_API_KEY). Prefers Claude if set.
"""

import os
from lib.mcp_client import get_mcp_tools, call_mcp_tool

MAX_TOOL_ROUNDS = 5


def _mcp_tool_to_openai(t: dict) -> dict:
    return {
        "type": "function",
        "function": {
            "name": t["name"],
            "description": t.get("description") or f"Tool: {t['name']}",
            "parameters": t.get("inputSchema") or {"type": "object", "properties": {}},
        },
    }


def _mcp_tool_to_anthropic(t: dict) -> dict:
    return {
        "name": t["name"],
        "description": t.get("description") or f"Tool: {t['name']}",
        "input_schema": t.get("inputSchema") or {"type": "object", "properties": {}},
    }


def run_chat_with_mcp(
    prompt: str,
    mcp_server_url: str,
    openai_api_key: str | None,
    claude_api_key: str | None,
    auth: dict | None = None,
) -> dict:
    """Run chat: get tools from MCP, then loop (LLM -> tool_calls -> MCP -> LLM) until done.
    Returns { reply: str, toolCalls?: list }.
    """
    auth = auth or {}
    use_claude = bool((claude_api_key or "").strip())
    api_key = (claude_api_key or "").strip() if use_claude else (openai_api_key or "").strip()

    if not api_key:
        raise ValueError(
            "No chat API key found. Add CLAUDE_API_KEY or ANTHROPIC_API_KEY (for Claude) or OPENAI_API_KEY (for OpenAI) to server .env."
        )

    tools_result = get_mcp_tools(mcp_server_url)
    tools = tools_result.get("tools") or []
    tool_call_results: list[dict] = []
    system_prompt = (
        "You are a helpful assistant that can use Webex Contact Center tools. "
        "When the user asks to list agents, get statistics, search tasks, or call any Contact Center API, use the appropriate tool. "
        "Reply concisely and show the user the relevant results."
    )

    if use_claude:
        return _run_claude(api_key, prompt, system_prompt, tools, mcp_server_url, auth, tool_call_results)

    return _run_openai(api_key, prompt, system_prompt, tools, mcp_server_url, auth, tool_call_results)


def _run_claude(api_key: str, prompt: str, system_prompt: str, tools: list, mcp_url: str, auth: dict, tool_call_results: list) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    model = os.environ.get("ANTHROPIC_CHAT_MODEL") or os.environ.get("CLAUDE_CHAT_MODEL") or "claude-sonnet-4-20250514"
    anthropic_tools = [_mcp_tool_to_anthropic(t) for t in tools]
    messages = [{"role": "user", "content": prompt}]
    round_count = 0

    while round_count < MAX_TOOL_ROUNDS:
        round_count += 1
        resp = client.messages.create(
            model=model,
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
            tools=anthropic_tools if anthropic_tools else None,
            tool_choice={"type": "auto"} if anthropic_tools else None,
        )
        content = resp.content or []
        tool_uses = [b for b in content if getattr(b, "type", None) == "tool_use"]
        if not tool_uses:
            text = "".join(getattr(b, "text", "") or "" for b in content if getattr(b, "type", None) == "text").strip()
            return {"reply": text or "(No reply)", "toolCalls": tool_call_results if tool_call_results else None}

        messages.append({"role": "assistant", "content": content})
        tool_results = []
        for tu in tool_uses:
            name = getattr(tu, "name", None) or ""
            inp = getattr(tu, "input", None) or {}
            tid = getattr(tu, "id", None) or ""
            result = call_mcp_tool(mcp_url, name, inp, auth)
            text = "".join(c.get("text", "") for c in (result.get("content") or []) if c.get("type") == "text").strip() or str(result)
            tool_call_results.append({"name": name, "result": text})
            tool_results.append({"type": "tool_result", "tool_use_id": tid, "content": text})
        messages.append({"role": "user", "content": tool_results})

    return {"reply": "Reached maximum tool-call rounds. Try a simpler request.", "toolCalls": tool_call_results if tool_call_results else None}


def _run_openai(api_key: str, prompt: str, system_prompt: str, tools: list, mcp_url: str, auth: dict, tool_call_results: list) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    model = os.environ.get("OPENAI_CHAT_MODEL") or "gpt-4o-mini"
    openai_tools = [_mcp_tool_to_openai(t) for t in tools]
    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}]
    round_count = 0

    while round_count < MAX_TOOL_ROUNDS:
        round_count += 1
        kwargs = {"model": model, "messages": messages, "max_tokens": 2048}
        if openai_tools:
            kwargs["tools"] = openai_tools
            kwargs["tool_choice"] = "auto"
        resp = client.chat.completions.create(**kwargs)
        choice = resp.choices[0] if resp.choices else None
        if not choice:
            return {"reply": "(No reply)", "toolCalls": tool_call_results if tool_call_results else None}
        msg = choice.message
        if msg.tool_calls:
            messages.append(msg)
            for tc in msg.tool_calls:
                name = (tc.function and tc.function.name) or ""
                args = {}
                if tc.function and tc.function.arguments:
                    import json
                    try:
                        args = json.loads(tc.function.arguments)
                    except Exception:
                        pass
                result = call_mcp_tool(mcp_url, name, args, auth)
                text = "".join(c.get("text", "") for c in (result.get("content") or []) if c.get("type") == "text").strip() or str(result)
                tool_call_results.append({"name": name, "result": text})
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": text})
            continue
        reply = (msg.content or "").strip() or "(No reply)"
        return {"reply": reply, "toolCalls": tool_call_results if tool_call_results else None}

    return {"reply": "Reached maximum tool-call rounds. Try a simpler request.", "toolCalls": tool_call_results if tool_call_results else None}
