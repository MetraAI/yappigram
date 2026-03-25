import json
from uuid import UUID

from fastapi import WebSocket


class WSManager:
    """Manages WebSocket connections per staff member, scoped by org."""

    def __init__(self):
        # staff_id -> list of active websockets
        self._connections: dict[UUID, list[WebSocket]] = {}
        # staff_id -> org_id (workspace isolation)
        self._staff_org: dict[UUID, str | None] = {}

    async def connect(self, staff_id: UUID, ws: WebSocket, org_id: str | None = None):
        await ws.accept()
        self._connections.setdefault(staff_id, []).append(ws)
        self._staff_org[staff_id] = org_id

    def disconnect(self, staff_id: UUID, ws: WebSocket):
        conns = self._connections.get(staff_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(staff_id, None)
            self._staff_org.pop(staff_id, None)

    async def send_to_staff(self, staff_id: UUID, event: dict):
        """Send event to all connections of a specific staff member."""
        dead: list[WebSocket] = []
        for ws in self._connections.get(staff_id, []):
            try:
                await ws.send_text(json.dumps(event, default=str))
            except Exception:
                dead.append(ws)
        # Clean up dead connections
        for ws in dead:
            self.disconnect(staff_id, ws)

    async def broadcast_to_staff_list(self, staff_ids: list[UUID], event: dict):
        """Send event to multiple staff members."""
        for sid in staff_ids:
            await self.send_to_staff(sid, event)

    def is_online(self, staff_id: UUID) -> bool:
        """Check if a staff member has any active WS connections (CRM is open)."""
        return bool(self._connections.get(staff_id))

    async def broadcast_to_org(self, org_id: str | None, event: dict):
        """Send event only to staff in the same workspace (org_id)."""
        if org_id is None:
            return  # No org = no broadcast
        for staff_id in list(self._connections.keys()):
            if self._staff_org.get(staff_id) == org_id:
                await self.send_to_staff(staff_id, event)

    async def broadcast_to_admins(self, event: dict, org_id: str | None = None):
        """Send to staff in the given org. Falls back to all if org_id is None (legacy)."""
        if org_id is not None:
            await self.broadcast_to_org(org_id, event)
        else:
            # Legacy fallback — should not happen after migration
            for staff_id in list(self._connections.keys()):
                await self.send_to_staff(staff_id, event)


ws_manager = WSManager()
