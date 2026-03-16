import { requireAuth } from "server/middlewares/auth.middleware";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  verifyEmailOTP,
  resetUserPassword
} from "../controllers/user.controller";
import type { Express } from "express";

export function userRoutes(app: Express) {
  app.get("/api/admin/users", requireAuth, getAllUsers);
  app.get("/api/admin/users/:id", requireAuth, getUserById);
  app.post("/api/admin/users/:id/reset-password", requireAuth, resetUserPassword);
  app.post("/api/users/create", requireAuth, createUser);
  app.post("/api/users/verifyEmail", verifyEmailOTP)
  app.put("/api/users/:id", requireAuth, updateUser);
  app.put("/api/user/status/:id", requireAuth, updateUserStatus);
  app.delete("/api/admin/users/:id", requireAuth, deleteUser);
}
