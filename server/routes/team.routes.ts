import { Router } from "express";
import { db } from "../db";
import {
  users,
  userActivityLogs,
  conversationAssignments,
  DEFAULT_PERMISSIONS,
  Permission,
} from "@shared/schema";
import { eq, desc, and, sql, ne, or, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { validateRequest } from "../middlewares/validateRequest.middleware";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware";
import { PERMISSIONS } from "@shared/schema";


const router = Router();

const PERMISSION_KEY_MAP: Record<string, string[]> = {
  canManageContacts: [
    "contacts:view",
    "contacts:create",
    "contacts:edit",
    "contacts:import",
    "contacts:export",
  ],
  canManageCampaigns: [
    "campaigns:view",
    "campaigns:create",
    "campaigns:edit",
    "campaigns:send",
    "campaigns:schedule",
  ],
  canManageTemplates: [
    "templates:view",
    "templates:create",
    "templates:edit",
    "templates:sync",
  ],
  canManageTeam: ["team:view", "team:create", "team:edit", "team:delete"],
  canViewAnalytics: ["analytics:view", "analytics:export"],
  canExportData: ["dashboard:export", "contacts:export", "analytics:export"],
};

// Validation schemas
const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  role: z.enum(["team"]),
  permissions: z
    .union([z.array(z.string()), z.record(z.boolean())])
    .optional()
    .transform((val) => {
      if (Array.isArray(val)) {
        // Already a valid permission array
        return val;
      }
      if (val && typeof val === "object") {
        // Expand boolean keys into full permissions
        return Object.keys(val).reduce((acc: string[], key) => {
          if (val[key] && PERMISSION_KEY_MAP[key]) {
            acc.push(...PERMISSION_KEY_MAP[key]);
          }
          return acc;
        }, []);
      }
      return [];
    }),
  avatar: z.string().optional(),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true });

const updatePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const updateStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

// Get all team members (created by current user)
// router.get(
//   "/members",
//   requireAuth,
//   requirePermission(PERMISSIONS.TEAM_VIEW),
//   async (req, res) => {
//     try {
//       const userId = req.user?.id;
//       if (!userId) {
//         return res.status(401).json({ error: "Unauthorized: User not found" });
//       }

//       const page = parseInt(req.query.page as string) || 1;
//       const limit = parseInt(req.query.limit as string) || 10;
//       const offset = (page - 1) * limit;

//       const members = await db
//         .select({
//           id: users.id,
//           username: users.username,
//           email: users.email,
//           firstName: users.firstName,
//           lastName: users.lastName,
//           role: users.role,
//           status: users.status,
//           permissions: users.permissions,
//           avatar: users.avatar,
//           lastLogin: users.lastLogin,
//           createdAt: users.createdAt,
//           updatedAt: users.updatedAt,
//           createdBy: users.createdBy,
//         })
//         .from(users)
//         .where(eq(users.createdBy, userId))
//         .orderBy(desc(users.createdAt))
//         .limit(limit)
//         .offset(offset);

//       const countResult = await db
//         .select({ count: sql<number>`COUNT(*)` })
//         .from(users)
//         .where(eq(users.createdBy, userId));

//       const total = countResult[0]?.count ?? 0;

//       res.json({
//         data: members,
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       });
//     } catch (error) {
//       console.error("Error fetching team members:", error);
//       res.status(500).json({ error: "Failed to fetch team members" });
//     }
//   }
// );


router.get(
  "/members",
  requireAuth,
  requirePermission(PERMISSIONS.TEAM_VIEW),
  async (req, res) => {
    try {
      const loggedInUser = req.user;

      if (!loggedInUser?.id) {
        return res.status(401).json({ error: "Unauthorized: User not found" });
      }

      const ownerUserId =
        loggedInUser.role === "team"
          ? loggedInUser.createdBy
          : loggedInUser.id;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const search = (req.query.search as string) || "";

      // OPTIONAL search condition
      const searchFilter = search
        ? or(
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.username, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
        : undefined;

      // MAIN QUERY
      const members = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          status: users.status,
          permissions: users.permissions,
          avatar: users.avatar,
          lastLogin: users.lastLogin,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          createdBy: users.createdBy,
        })
        .from(users)
        .where(
          and(eq(users.createdBy, ownerUserId), searchFilter ?? undefined)
        )
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      // COUNT
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .where(
          and(eq(users.createdBy, ownerUserId), searchFilter ?? undefined)
        );

      const total = countResult[0]?.count ?? 0;

      res.json({
        data: members,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  }
);





router.post("/membersByUserId", async (req, res) => {
  try {
    const { userId, page = 1, limit = 10 } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch total count first
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.createdBy, userId))
      .execute();

    const total = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Fetch paginated members
    const members = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        status: users.status,
        permissions: users.permissions,
        avatar: users.avatar,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        createdBy: users.createdBy,
      })
      .from(users)
      .where(eq(users.createdBy, userId))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: members,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});



// Get single team member
router.get("/members/:id", requireAuth,
  requirePermission(PERMISSIONS.TEAM_VIEW), async (req, res) => {
    try {
      const [member] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.params.id));

      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }

      // Remove password from response
      const { password, ...memberData } = member;
      res.json(memberData);
    } catch (error) {
      console.error("Error fetching team member:", error);
      res.status(500).json({ error: "Failed to fetch team member" });
    }
  });

// Create team member
router.post("/members", requireAuth,
  requirePermission(PERMISSIONS.TEAM_CREATE), validateRequest(createUserSchema), async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        firstName,
        lastName,
        role,
        permissions,
        avatar,
      } = req.body;

      // Check if email or username already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(sql`${users.email} = ${email} OR ${users.username} = ${username}`);

      if (existingUser) {
        return res.status(400).json({ error: "Username or email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      console.log({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        role: "team",
        permissions,
        avatar: avatar || null,
        status: "active",
        created_by: (req.user as { id: string }).id
      })

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          firstName,
          lastName,
          role: 'team',
          permissions, // already an array from schema
          avatar: avatar || null,
          status: "active",
          isEmailVerified: true,
          createdBy: (req.user as { id: string }).id
        })
        .returning();

      await db.insert(userActivityLogs).values({
        userId: newUser.id,
        action: "user_created",
        entityType: "user",
        entityId: newUser.id,
        details: { createdBy: "admin" },
      });

      const { password: _, ...userData } = newUser;
      res.json(userData);
    } catch (error) {
      console.error("Error creating team member:", error);
      res.status(500).json({ error: error || "Failed to create team member" });
    }
  });


// Update team member
router.put(
  "/members/:id", requireAuth,
  validateRequest(updateUserSchema),
  async (req, res) => {
    console.log("Update member called")
    try {
      const { id } = req.params;
      const updates = req.body;

      console.log("Updates : ===> ", updates)

      const [member] = await db
        .update(users)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }

      // Log activity
      await db.insert(userActivityLogs).values({
        userId: id,
        action: "user_updated",
        entityType: "user",
        entityId: id,
        details: { updates },
      });

      // Remove password from response
      const { password, ...memberData } = member;
      res.json(memberData);
    } catch (error) {
      console.error("Error updating team member:", error);
      res.status(500).json({ error: "Failed to update team member" });
    }
  }
);

// Update team member status
router.patch(
  "/members/:id/status", requireAuth,
  requirePermission(PERMISSIONS.TEAM_EDIT),
  validateRequest(updateStatusSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const [member] = await db
        .update(users)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }

      // Log activity
      await db.insert(userActivityLogs).values({
        userId: id,
        action: "status_changed",
        entityType: "user",
        entityId: id,
        details: { newStatus: status },
      });

      // Remove password from response
      const { password, ...memberData } = member;
      res.json(memberData);
    } catch (error) {
      console.error("Error updating team member status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  }
);

// Update user password
router.patch(
  "/members/:id/password", requireAuth,
  validateRequest(updatePasswordSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      // Get user to verify current password
      const [user] = await db.select().from(users).where(eq(users.id, id));

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db
        .update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      // Log activity
      await db.insert(userActivityLogs).values({
        userId: id,
        action: "password_changed",
        entityType: "user",
        entityId: id,
        details: {},
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ error: "Failed to update password" });
    }
  }
);

// Delete team member
router.delete("/members/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting the last admin
    const [adminCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, id)));

    const [userToDelete] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, id));

    if (userToDelete?.role === "admin" && adminCount.count === 0) {
      return res.status(400).json({
        error: "Cannot delete the last admin user",
      });
    }

    console.log("userToDelete", userToDelete)

    // Check if user has active assignments
    const [hasAssignments] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversationAssignments)
      .where(
        and(
          eq(conversationAssignments.userId, id),
          eq(conversationAssignments.status, "active")
        )
      );

    // console.log("NEW RES")

    if (hasAssignments && hasAssignments.count > 0) {
      return res.status(400).json({
        error: "Cannot delete user with active conversation assignments",
      });
    }

    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});


// get activity logs
router.get("/activity-logs", async (req, res) => {
  try {
    const loggedInUserId = req?.session?.user?.id;
    const role = req?.session?.user?.role;   // <-- Make sure role is stored in session or JWT

    if (!loggedInUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Base query
    let query = db
      .select({
        id: userActivityLogs.id,
        userId: userActivityLogs.userId,
        userName: users.username,
        userEmail: users.email,
        action: userActivityLogs.action,
        entityType: userActivityLogs.entityType,
        entityId: userActivityLogs.entityId,
        details: userActivityLogs.details,
        ipAddress: userActivityLogs.ipAddress,
        userAgent: userActivityLogs.userAgent,
        createdAt: userActivityLogs.createdAt,
      })
      .from(userActivityLogs)
      .leftJoin(users, eq(userActivityLogs.userId, users.id))
      .orderBy(desc(userActivityLogs.createdAt))
      .limit(100);

    // Apply restriction only if not superadmin
    if (role !== "superadmin") {
      query = query.where(eq(users.createdBy, loggedInUserId));
    }

    const logs = await query;

    res.json(logs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});



// router.get("/activity-logs", async (req, res) => {
//   try {
//     const loggedInUserId = req?.session?.user?.id;

//     if (!loggedInUserId) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     // Fetch ALL activity logs (No filter)
//     const logs = await db
//       .select({
//         id: userActivityLogs.id,
//         userId: userActivityLogs.userId,
//         userName: users.username,
//         userEmail: users.email,
//         action: userActivityLogs.action,
//         entityType: userActivityLogs.entityType,
//         entityId: userActivityLogs.entityId,
//         details: userActivityLogs.details,
//         ipAddress: userActivityLogs.ipAddress,
//         userAgent: userActivityLogs.userAgent,
//         createdAt: userActivityLogs.createdAt,
//       })
//       .from(userActivityLogs)
//       .leftJoin(users, eq(userActivityLogs.userId, users.id))
//       .orderBy(desc(userActivityLogs.createdAt))
//       .limit(100);

//     res.json(logs);

//   } catch (error) {
//     console.error("Error fetching activity logs:", error);
//     res.status(500).json({ error: "Failed to fetch activity logs" });
//   }
// });



// Update member permissions
router.patch("/members/:id/permissions", requireAuth,
  requirePermission(PERMISSIONS.TEAM_PERMISSIONS), async (req, res) => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      const [member] = await db
        .update(users)
        .set({
          permissions,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!member) {
        return res.status(404).json({ error: "User not found" });
      }

      // Log activity
      await db.insert(userActivityLogs).values({
        userId: id,
        action: "permissions_updated",
        entityType: "user",
        entityId: id,
        details: { permissions },
      });

      // Remove password from response
      const { password, ...memberData } = member;
      res.json(memberData);
    } catch (error) {
      console.error("Error updating permissions:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

// Bulk delete activity logs
router.delete("/activity-logs/bulk", requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid or empty IDs array" });
    }

    await db
      .delete(userActivityLogs)
      .where(inArray(userActivityLogs.id, ids));

    res.json({ success: true, message: "Activity logs deleted successfully" });
  } catch (error) {
    console.error("Error bulk deleting activity logs:", error);
    res.status(500).json({ error: "Failed to delete activity logs" });
  }
});

export default router;
