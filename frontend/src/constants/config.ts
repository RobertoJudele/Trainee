// frontend/src/constants/config.ts
const DEV_IP = "10.50.20.58"; // Update this when your IP changes

export const API_URL = __DEV__ 
  ? `http://${DEV_IP}:8000`
  : "https://your-production-api.com";