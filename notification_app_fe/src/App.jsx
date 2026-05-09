import { useState, useMemo } from "react";
import {
  AppBar, Toolbar, Typography, Box, CssBaseline,
  IconButton, Badge, Tooltip, createTheme, ThemeProvider,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import NotificationList from "./components/NotificationList";

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: { main: "#6366f1" },
          success: { main: "#22c55e" },
          warning: { main: "#f59e0b" },
        },
        shape: { borderRadius: 12 },
      }),
    [darkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ backdropFilter: "blur(8px)" }}>
        <Toolbar sx={{ gap: 1 }}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1, ml: 1 }}>
            Notification Center
          </Typography>
          <Tooltip title={darkMode ? "Light mode" : "Dark mode"}>
            <IconButton color="inherit" onClick={() => setDarkMode((d) => !d)}>
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ maxWidth: 1200, mx: "auto" }}>
        <NotificationList onUnreadChange={setUnreadCount} />
      </Box>
    </ThemeProvider>
  );
}
