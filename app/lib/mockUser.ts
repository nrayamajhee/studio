export interface MockUser {
  id: string;
  name: string;
  email: string;
  provider: "google" | "apple";
  avatar: string;
  role?: string;
  handle?: string;
  loggedAt: number;
}

export const MOCK_GOOGLE_USER: MockUser = {
  id: "google_user",
  name: "Google User",
  email: "producer@gmail.com",
  provider: "google",
  avatar: "G",
  role: "Google Producer",
  handle: "@google_user",
  loggedAt: 0,
};

export const MOCK_APPLE_USER: MockUser = {
  id: "apple_user",
  name: "Apple User",
  email: "producer@icloud.com",
  provider: "apple",
  avatar: "",
  role: "Apple Producer",
  handle: "@apple_user",
  loggedAt: 0,
};

export const PRESET_MOCK_USERS: MockUser[] = [
  MOCK_GOOGLE_USER,
  MOCK_APPLE_USER,
];
