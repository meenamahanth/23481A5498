import { useState, useEffect, useCallback } from "react";
import {
  Grid, MenuItem, Select, FormControl, InputLabel,
  Box, Button, Typography, CircularProgress, Alert,
  Chip, Tabs, Tab, Badge,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import NotificationsIcon from "@mui/icons-material/Notifications";
import StarIcon from "@mui/icons-material/Star";
import NotificationCard from "./NotificationCard";
import { fetchNotifications } from "../api/notifications";

const TYPES = ["All", "Event", "Result", "Placement"];
const LIMIT = 6;
const LS_KEY = "readNotificationIds";
const PRIORITY_ORDER = { Placement: 0, Result: 1, Event: 2 };

const getReadIds = () => {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY)) || []); }
  catch { return new Set(); }
};
const saveReadIds = (set) =>
  localStorage.setItem(LS_KEY, JSON.stringify([...set]));

function EmptyState({ message }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" mt={10} gap={2}>
      <InboxIcon sx={{ fontSize: 72, color: "text.disabled" }} />
      <Typography variant="h6" color="text.secondary">{message}</Typography>
      <Typography variant="body2" color="text.disabled">
        Try changing the filter or check back later.
      </Typography>
    </Box>
  );
}

function CardGrid({ items, readIds, onMarkRead }) {
  if (items.length === 0) return <EmptyState message="No notifications here" />;
  return (
    <Grid container spacing={3}>
      {items.map((n) => (
        <Grid item xs={12} sm={6} md={4} key={n.ID}>
          <NotificationCard
            notification={n}
            isRead={readIds.has(n.ID)}
            onMarkRead={() => onMarkRead(n.ID)}
          />
        </Grid>
      ))}
    </Grid>
  );
}

export default function NotificationList({ onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);
  const [type, setType] = useState("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [readIds, setReadIds] = useState(getReadIds);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await fetchNotifications(type, page, LIMIT);
        setNotifications(data.notifications ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        console.log(error);
        setError(error.response?.data?.message || error.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [type, page]);

  useEffect(() => {
    const unread = notifications.filter((n) => !readIds.has(n.ID)).length;
    onUnreadChange?.(unread);
  }, [notifications, readIds, onUnreadChange]);

  const markRead = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = () => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.ID));
      saveReadIds(next);
      return next;
    });
  };

  const totalPages = Math.ceil(total / LIMIT);
  const unreadCount = notifications.filter((n) => !readIds.has(n.ID)).length;

  const priorityList = notifications
    .filter((n) => !readIds.has(n.ID))
    .sort((a, b) => (PRIORITY_ORDER[a.Type] ?? 3) - (PRIORITY_ORDER[b.Type] ?? 3));

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>

      {/* Filter + actions row */}
      <Box display="flex" flexWrap="wrap" alignItems="center" gap={2} mb={3}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Filter by Type</InputLabel>
          <Select
            value={type}
            label="Filter by Type"
            onChange={(e) => { setType(e.target.value); setPage(1); }}
          >
            {TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        {unreadCount > 0 && (
          <Chip label={`${unreadCount} unread`} color="error" size="small" />
        )}
        {unreadCount > 0 && (
          <Button size="small" variant="text" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          icon={<NotificationsIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Badge badgeContent={notifications.length} color="primary" max={99}>
              <Box sx={{ pr: 1.5 }}>All</Box>
            </Badge>
          }
        />
        <Tab
          icon={<StarIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Badge badgeContent={priorityList.length} color="warning" max={99}>
              <Box sx={{ pr: 1.5 }}>Priority</Box>
            </Badge>
          }
        />
      </Tabs>

      {/* Loading */}
      {loading && (
        <Box display="flex" flexDirection="column" alignItems="center" mt={8} gap={2}>
          <CircularProgress size={52} thickness={4} />
          <Typography color="text.secondary">Loading notifications…</Typography>
        </Box>
      )}

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tab panels */}
      {!loading && !error && (
        <>
          {tab === 0 && (
            <CardGrid
              items={notifications}
              readIds={readIds}
              onMarkRead={markRead}
            />
          )}
          {tab === 1 && (
            <CardGrid
              items={priorityList}
              readIds={readIds}
              onMarkRead={markRead}
            />
          )}

          {/* Pagination */}
          <Box display="flex" justifyContent="center" alignItems="center" gap={2} mt={5}>
            <Button
              variant="outlined"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Typography variant="body2">
              Page {page} of {totalPages || 1}
            </Typography>
            <Button
              variant="outlined"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
