import queue
import threading

_subscribers = set()
_lock = threading.Lock()

def register_queue(q: queue.Queue):
    with _lock:
        _subscribers.add(q)

def unregister_queue(q: queue.Queue):
    with _lock:
        _subscribers.discard(q)

def publish(event_str: str):
    """Publish a raw datastar event string to all subscribers."""
    with _lock:
        subs = list(_subscribers)
    for q in subs:
        try:
            q.put(event_str)
        except Exception:
            # best-effort; ignore failing subscribers
            pass
