"""Steps for messages the bot posts around rollcalls."""
from typing import Any, Callable, Dict, List

from behave import then, use_step_matcher
from behave.runner import Context

import helpers

use_step_matcher("re")


def _await_post(context: Context, accept: Callable[[Dict[str, Any]], bool], description: str) -> None:
    def posted() -> List[Dict[str, Any]]:
        new: List[Dict[str, Any]] = helpers.get_outbox(context.cmd_chat)[context.cmd_baseline:]
        return [m for m in new if m["method"] == "sendMessage" and accept(m)]

    found: List[Dict[str, Any]] = helpers.wait_until(posted)
    assert found, f"Expected the bot to post a message {description}"
    context.last_message = found[-1]
    context.last_reply = found[-1]["text"]


@then('the bot posts a message starting with "(?P<expected>[^"]*)"')
def step_bot_posts(context: Context, expected: str) -> None:
    _await_post(context, lambda m: m["text"].startswith(expected), f"starting with {expected!r}")


@then('the bot posts no message starting with "(?P<unexpected>[^"]*)"')
def step_bot_posts_none(context: Context, unexpected: str) -> None:
    posted: List[Dict[str, Any]] = [
        m for m in helpers.expect_no_new_message(context.cmd_chat, context.cmd_baseline)
        if m["method"] == "sendMessage" and m["text"].startswith(unexpected)
    ]
    assert not posted, f"Expected no message starting with {unexpected!r}, got {[m['text'] for m in posted]}"
