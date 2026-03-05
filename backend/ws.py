import json
from uuid import UUID

from fastapi import WebSocket


class WSManager:
    """Manages WebSocket connections per staff member."""

    def __init__(self):
        # staff_id -> list of active websockets
        self._connections: dict[UUID, list[WebSocket]] = {}

    async def connect(self, staff_id: UUID, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(staff_id, []).append(ws)

    def disconnect(self, staff_id: UUID, ws: WebSocket):
        conns = self._connections.get(staff_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(staff_id, None)

    async def send_to_staff(self, staff_id: UUID, event: dict):
        """Send event to all connections of a specific staff member."""
        for ws in self._connections.get(staff_id, []):
            try:
                await ws.send_text(json.dumps(event, default=str))
            except Exception:
                pass

    async def broadcast_to_staff_list(self, staff_ids: list[UUID], event: dict):
        """Send event to multiple staff members."""
        for sid in staff_ids:
            await self.send_to_staff(sid, event)

    def is_online(self, staff_id: UUID) -> bool:
        """Check if a staff member has any active WS connections (CRM is open)."""
        return bool(self._connections.get(staff_id))

    async def broadcast_to_admins(self, event: dict):
        """Send to all connected users (admins will filter client-side)."""
        for staff_id in list(self._connections.keys()):
            await self.send_to_staff(staff_id, event)


ws_manager = WSManager()
