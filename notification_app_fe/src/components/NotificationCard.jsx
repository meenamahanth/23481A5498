import { Card, CardContent, Typography, Chip, Box, Button } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

const typeColors = { Event: "primary", Result: "success", Placement: "warning" };

export default function NotificationCard({ notification, isRead, onMarkRead }) {
  const { Message, Type, Timestamp } = notification;
  const isPriority = !isRead && Type === "Placement";

  return (
    <Card
      elevation={isRead ? 1 : 4}
      sx={{
        borderRadius: 3,
        height: "100%",
        border: isRead ? "1px solid" : "2px solid",
        borderColor: isRead ? "divider" : `${typeColors[Type] || "primary"}.main`,
        opacity: isRead ? 0.6 : 1,
        position: "relative",
        overflow: "visible",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: isRead ? 3 : 8,
        },
      }}
    >
      {/* Priority badge */}
      {isPriority && (
        <Box
          sx={{
            position: "absolute",
            top: -11,
            right: 14,
            bgcolor: "warning.main",
            color: "#fff",
            borderRadius: 2,
            px: 1,
            py: 0.25,
            display: "flex",
            alignItems: "center",
            gap: 0.4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          <StarIcon sx={{ fontSize: 12 }} /> PRIORITY
        </Box>
      )}

      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        {/* Type chip + timestamp */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Chip label={Type} color={typeColors[Type] || "default"} size="small" />
          <Box display="flex" alignItems="center" gap={0.4}>
            <AccessTimeIcon sx={{ fontSize: 13, color: "text.disabled" }} />
            <Typography variant="caption" color="text.secondary">
              {new Date(Timestamp).toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {/* Message */}
        <Typography
          variant="body1"
          fontWeight={isRead ? 400 : 600}
          mb={2}
          sx={{ lineHeight: 1.6 }}
        >
          {Message}
        </Typography>

        {/* Action / status */}
        {isRead ? (
          <Box display="flex" alignItems="center" gap={0.5}>
            <CheckCircleOutlineIcon sx={{ fontSize: 15, color: "text.disabled" }} />
            <Typography variant="caption" color="text.disabled">Read</Typography>
          </Box>
        ) : (
          <Button
            size="small"
            variant="outlined"
            color={typeColors[Type] || "primary"}
            onClick={onMarkRead}
            startIcon={<CheckCircleOutlineIcon />}
          >
            Mark as Read
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
