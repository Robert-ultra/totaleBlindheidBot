"""Steps for messages the bot posts around rollcalls."""
import time
from typing import Any, Callable, Dict, List, Tuple

from behave import then, use_step_matcher, when
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


@then('the bot posts only one message starting with "(?P<expected>[^"]*)"')
def step_bot_posts_once(context: Context, expected: str) -> None:
    time.sleep(helpers.QUIET_WINDOW)
    posted: List[Dict[str, Any]] = [
        m for m in helpers.get_outbox(context.cmd_chat)[context.cmd_baseline:]
        if m["method"] == "sendMessage" and m["text"].startswith(expected)
    ]
    assert len(posted) == 1, f"Expected one message starting with {expected!r}, got {[m['text'] for m in posted]}"


@when('the scheduled rollcall is (?P<minutes>\\d+) minutes away')
def step_schedule_minutes_away(context: Context, minutes: str) -> None:
    """Move the schedule as if time passed, ageing its RSVP list by the same amount."""
    context.cmd_chat = context.chat_id
    context.cmd_baseline = len(helpers.get_outbox(context.chat_id))
    until: str = f"NOW() + INTERVAL {int(minutes)} MINUTE"
    conn = helpers.db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE rsvp_list l JOIN rollcall_schedule s ON s.rsvp_list_id = l.id "
                f"SET l.created_at = l.created_at - INTERVAL TIMESTAMPDIFF(MICROSECOND, {until}, s.trigger_at) MICROSECOND "
                "WHERE s.chat_id = %s",
                (context.chat_id,)
            )
            cur.execute(f"UPDATE rollcall_schedule SET trigger_at = {until} WHERE chat_id = %s", (context.chat_id,))
    finally:
        conn.close()


@then('no rollcall is scheduled for the chat')
def step_not_scheduled(context: Context) -> None:
    rows: List[Tuple[Any, ...]] = helpers.db_rows("SELECT id FROM rollcall_schedule WHERE chat_id = %s", (context.chat_id,))
    assert not rows, f"Expected no schedule, got {rows}"
