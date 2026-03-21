// frontend/src/constants/config.ts
const WORK_IP = "10.50.20.58"; // Update this when your IP changes
const HOME_IP = "192.168.1.129"; // Update this when your IP changes
export const API_URL = __DEV__ 
  ? `http://${WORK_IP}:8000`
  : "https://your-production-api.com";