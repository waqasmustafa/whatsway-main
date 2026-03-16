import { Request, Response } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, or, like, sql, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { otpVerifications } from "@shared/schema";
import { sendOTPEmailVerify } from "../services/email.service";


// Default permissions 
const defaultPermissions = [
  // Contacts
  'contacts:view',
  'contacts:create',
  'contacts:edit',
  'contacts:delete',
  'contacts:export',

  // Campaigns
  'campaigns:view',
  'campaigns:create',
  'campaigns:edit',
  'campaigns:delete',

  // Templates
  'templates:view',
  'templates:create',
  'templates:edit',
  'templates:delete',

  // Analytics
  'analytics:view',

  // Team
  'team:view',
  'team:create',
  'team:edit',
  'team:delete',

  // Settings
  'settings:view',

  // Inbox
  'inbox:view',
  'inbox:send',
  'inbox:assign',

  // Automations
  'automations:view',
  'automations:create',
  'automations:edit',
  'automations:delete',
];


export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const role = (req.query.role as string) || "admin";
    const offset = (page - 1) * limit;

    const conditions = [
      eq(users.role, role),
      search ? or(
        like(users.username, sql`${'%' + search + '%'}`),
        like(users.email, sql`${'%' + search + '%'}`)
      ) : undefined,
    ].filter(Boolean);

    const allUsers = await db
      .select()
      .from(users)
      .where(and(...(conditions as any)))
      .limit(limit)
      .offset(offset)
    // .orderBy(users.createdAt, "desc");

    const totalCountResult = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(users)
      .where(and(...(conditions as any)));

    const total = totalCountResult[0]?.total ?? 0;


    res.status(200).json({
      success: true,
      data: allUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Error fetching users", error });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await db.select().from(users).where(eq(users.id, id));
    if (!user.length) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, data: user[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching user", error });
  }
};





export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, password, email, firstName, lastName, role, avatar } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: "Username, password, and email are required.",
      });
    }

    // Check existing user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username already exists.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        role: role || "admin",
        avatar,
        permissions: defaultPermissions,
        isEmailVerified: true,
        status: "active",
      })
      .returning();

    const user = newUser[0];

    // ----- Generate OTP -----
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log(`Generated OTP for ${email}: ${otpCode} (expires at ${expiresAt.toISOString()})`);
    // Save OTP
    await db.insert(otpVerifications).values({
      userId: user.id,
      otpCode,
      expiresAt,
      isUsed: false,
    });

    // Send OTP Email
    await sendOTPEmailVerify(email, otpCode, firstName);

    return res.status(201).json({
      success: true,
      message: "User created. Verification OTP sent to email.",
      data: { id: user.id, email },
    });

  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating user",
      error,
    });
  }
};



export const verifyEmailOTP = async (req: Request, res: Response) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    // User fetch
    const user = await db.select().from(users).where(eq(users.email, email));
    if (!user.length) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const userData = user[0];

    // OTP fetch
    const otpRecord = await db
      .select()
      .from(otpVerifications)
      .where(eq(otpVerifications.userId, userData.id))
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);

    if (!otpRecord.length) {
      return res.status(400).json({
        success: false,
        message: "No OTP found.",
      });
    }

    const otp = otpRecord[0];

    // Check OTP validity
    if (otp.isUsed) {
      return res.status(400).json({ success: false, message: "OTP already used." });
    }

    if (otp.otpCode !== otpCode) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    if (new Date() > otp.expiresAt) {
      return res.status(400).json({ success: false, message: "OTP expired." });
    }

    // Mark OTP as used
    await db
      .update(otpVerifications)
      .set({ isUsed: true })
      .where(eq(otpVerifications.id, otp.id));

    // Mark user email verified
    await db
      .update(users)
      .set({ isEmailVerified: true })
      .where(eq(users.id, userData.id));

    return res.json({
      success: true,
      message: "Email verified successfully.",
    });

  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
      error,
    });
  }
};



export const createUserOld = async (req: Request, res: Response) => {
  try {
    const { username, password, email, firstName, lastName, role, avatar, permissions } = req.body;

    // 🧱 Validate required fields
    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: "Username, password, and email are required.",
      });
    }

    // 🔍 Check if username already exists
    const existingUser = await db.select().from(users).where(eq(users.username, username));
    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username already exists. Please choose another one.",
      });
    }

    // 🔒 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 📝 Insert new user
    const newUser = await db
      .insert(users)
      .values({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        role: role || "admin",
        avatar,
        permissions: defaultPermissions,
      })
      .returning();

    return res.status(201).json({
      success: true,
      data: newUser[0],
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating user",
      error,
    });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await db.update(users).set(updates).where(eq(users.id, id)).returning();

    res.status(200).json({ success: true, data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating user", error });
  }
};


export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const allowed = ["active", "inactive"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed: active, inactive",
      });
    }

    // Update status only
    const updated = await db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();

    // No user found
    if (!updated.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updated[0],
    });

  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating status",
      error,
    });
  }
};


export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(users).where(eq(users.id, id));
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting user", error });
  }
};

export const resetUserPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Verify if requester is superadmin
    if ((req.user as any)?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: "Only superadmins can reset user passwords."
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password is required and must be at least 6 characters long."
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updated = await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated.length) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "User password reset successfully"
    });

  } catch (error) {
    console.error("Error resetting user password:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting user password",
      error
    });
  }
};
