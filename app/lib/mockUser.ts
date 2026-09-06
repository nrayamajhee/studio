export interface MockUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
  email?: string;
  loggedAt: number;
}

export const PRESET_MOCK_USERS: MockUser[] = [
  {
    id: "nishan",
    name: "Nishan",
    role: "Lead Producer",
    avatar: "🎹",
    email: "nishan@studio.local",
    loggedAt: Date.now(),
  },
  {
    id: "maya",
    name: "Maya Beats",
    role: "Beatmaker & Drummer",
    avatar: "🥁",
    email: "maya@studio.local",
    loggedAt: Date.now(),
  },
  {
    id: "alex",
    name: "Alex Waves",
    role: "Sound Designer",
    avatar: "⚡",
    email: "alex@studio.local",
    loggedAt: Date.now(),
  },
  {
    id: "sam",
    name: "Sam Melody",
    role: "Composer",
    avatar: "🎼",
    email: "sam@studio.local",
    loggedAt: Date.now(),
  },
];
