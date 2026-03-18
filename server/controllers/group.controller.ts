import { groups, contacts } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { Request } from "express";
import { db } from "server/db";
import { Response } from "express";

export const createGroup = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session?.user;
    const { name, description, channelId } = req.body;

    const [group] = await db
      .insert(groups)
      .values({ name, description, createdBy: user?.id, channelId })
      .returning();

    res.json({ success: true, group });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Something went wrong";
    res.status(500).json({ error: errorMsg });
  }
};

export const getGroups = async (req: Request, res: Response) => {
  try {
    const { channelId } = req.query;
    console.log("getGroups", channelId);

    // Subquery to count contacts for each group
    // We use sql to check if the group name exists in the contacts.groups JSONB array
    const contactCountSql = sql<number>`(
      SELECT count(*)
      FROM ${contacts}
      WHERE ${contacts.groups} @> jsonb_build_array(${groups.name})
    )`;

    let query = db
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        channelId: groups.channelId,
        createdBy: groups.createdBy,
        createdAt: groups.createdAt,
        contactCount: contactCountSql,
      })
      .from(groups);

    if (channelId) {
      query = query.where(eq(groups.channelId, String(channelId)));
    }

    const data = await query;
    res.json({ success: true, groups: data });

  } catch (e: any) {
    console.error("Error in getGroups:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

export const getGroupById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, id));

    if (!group) return res.status(404).json({ error: "Group not found" });

    res.json({ success: true, group });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Something went wrong";
    res.status(500).json({ error: errorMsg });
  }
};

export const updateGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const [updated] = await db
      .update(groups)
      .set({ name, description })
      .where(eq(groups.id, id))
      .returning();

    res.json({ success: true, updated });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Something went wrong";
    res.status(500).json({ error: errorMsg });
  }
};

export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(groups)
      .where(eq(groups.id, id))
      .returning();

    res.json({ success: true, deleted });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Something went wrong";
    res.status(500).json({ error: errorMsg });
  }
};
