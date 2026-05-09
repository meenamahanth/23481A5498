import axios from "axios";

export const fetchNotifications = async (type, page, limit) => {
  const params = { page, limit };
  if (type !== "All") params.type = type;
  return axios.get("/notifications", { params });
};
