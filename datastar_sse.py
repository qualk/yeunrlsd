
from flask import Response, request
from datastar_py.sse import ServerSentEventGenerator as SSE, SSE_HEADERS
from datastar_py.consts import ElementPatchMode

def datastar_merge_fragment(html, selector=None, merge_mode=None, use_view_transition=True):
    # Compose SSE event for Datastar client using patch_elements
    mode = merge_mode or ElementPatchMode.OUTER
    event = SSE.patch_elements(
        elements=html,
        selector=selector,
        mode=mode,
        use_view_transition=use_view_transition
    )
    return Response(event, headers=SSE_HEADERS, mimetype='text/event-stream')
