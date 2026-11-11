"""Steps for recurring rollcalls, lobbies and reminders."""
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from behave import then, use_step_matcher, when
from behave.runner import Context

import helpers

use_step_matcher("re")


def _schedule(chat_id: int) -> Optional[Tuple[Any, ...]]:
    rows: List[Tuple[Any, ...]] = helpers.db_rows(
        "SELECT trigger_at > NOW(), rsvp_list_id, recurrence FROM rollcall_schedule WHERE chat_id = %s", (chat_id,)
    )
    return rows[0] if rows else None


def _mark_baseline(context: Context) -> None:
    context.cmd_chat = context.chat_id
    context.cmd_baseline = len(helpers.get_outbox(context.chat_id))


@when('the user sends "(?P<command>/\\w+) every" with the weekday and time (?P<hours>\\d+) hours ahead')
def step_send_weekly(context: Context, command: str, hours: str) -> None:
    at: datetime = datetime.now(timezone.utc) + timedelta(hours=int(hours))
    context.execute_steps(f'When the user sends "{command} every {at.strftime("%A").lower()} {at.strftime("%H:%M")}"')


@when('the scheduled rollcall is (?P<hours>\\d+) hours away')
def step_schedule_hours_away(context: Context, hours: str) -> None:
    _mark_baseline(context)
    conn = helpers.db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE rollcall_schedule SET trigger_at = NOW() + INTERVAL %s HOUR WHERE chat_id = %s", (int(hours), context.chat_id)
            )
    finally:
        conn.close()


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


@then('the bot posts a message offering a "(?P<label>[^"]*)" button')
def step_bot_posts_button(context: Context, label: str) -> None:
    _await_post(context, lambda m: label in helpers.button_labels(m), f"offering a {label!r} button")


@then('a weekly rollcall is still scheduled for the chat')
def step_still_scheduled(context: Context) -> None:
    def future() -> Optional[Tuple[Any, ...]]:
        schedule: Optional[Tuple[Any, ...]] = _schedule(context.chat_id)
        return schedule if schedule and schedule[0] and schedule[2] else None

    assert helpers.wait_until(future), f"Expected a future weekly schedule, got {_schedule(context.chat_id)}"


@then('no rollcall is scheduled for the chat')
def step_not_scheduled(context: Context) -> None:
    assert _schedule(context.chat_id) is None, f"Expected no schedule, got {_schedule(context.chat_id)}"
