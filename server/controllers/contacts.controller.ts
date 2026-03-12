import type { Request, Response } from "express";
import { storage } from "../storage";
import { contacts, users, insertContactSchema } from "@shared/schema";
import { AppError, asyncHandler } from "../middlewares/error.middleware";
import { db } from "server/db";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";


interface RequestWithChannel extends Request {
  query: {
    search?: string;
    channelId?: string;
    page?: string;
    limit?: string;
    group?: string;
    status?: string;
    createdBy?: string;
  };
}

export const getContacts = asyncHandler(
  async (req: RequestWithChannel, res: Response) => {
    const { search, channelId } = req.query;

    // console.log("Get Contacts Query Params:", { search, channelId });

    let contacts;
    if (channelId && typeof channelId === "string") {
      contacts = await storage.getContactsByChannel(channelId);;
    } else {
      contacts = await storage.getContacts();
    }

    // Apply search filter if provided
    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      contacts = contacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchLower) ||
          contact.phone.includes(search) ||
          contact.email?.toLowerCase().includes(searchLower)
      );
    }

    res.json(contacts);
  }
);

export const getContactsByUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 1000;

  if (!userId) {
    throw new AppError(400, "User ID is required");
  }

  // Storage method call with pagination
  const result = await storage.getContactsByUser(userId, page, limit);

  res.json({
    status: "success",
    data: result.data,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
});


// export const getContactsWithPagination = asyncHandler(
//   async (req: RequestWithChannel, res: Response) => {
//     const { search, channelId, page = "1", limit = "10" , group , status } = req.query;

//     // console.log("Query Params:", { search, channelId, page, limit, group, status });

//     const currentPage = parseInt(page, 10);
//     const pageSize = parseInt(limit, 10);
//     const offset = (currentPage - 1) * pageSize;

//     // Build dynamic WHERE conditions
//     const conditions = [];

//     if (channelId && typeof channelId === "string") {
//       conditions.push(eq(contacts.channelId, channelId));
//     }

//     if (search && typeof search === "string") {
//       const searchTerm = `%${search.toLowerCase()}%`;
//       conditions.push(
//         or(
//           ilike(contacts.name, searchTerm),
//           ilike(contacts.email, searchTerm),
//           ilike(contacts.phone, `%${search}%`)
//         )
//       );
//     }

//     if (group && typeof group === "string") {
//       const groupList = group.split(',').map(g => g.trim());
//       if (groupList.length > 0) {
//         const jsonArray = JSON.stringify(groupList);
//         conditions.push(
//           sql`${contacts.groups} @> ${sql.raw(`'${jsonArray}'::jsonb`)}`
//         );
//       }
//     }





//     if (status && typeof status === "string") {
//       conditions.push(eq(contacts.status, status)); // Assuming `contacts.status` is the column name
//     }

//     // Prepare the WHERE clause
//     const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

//     // 1. Get total count
//     const totalQuery = db
//       .select({ count: sql<number>`count(*)` })
//       .from(contacts)
//       .where(whereClause);
//     const totalResult = await totalQuery;
//     const total = totalResult[0]?.count ?? 0;

//     // 2. Get paginated data
//     const dataQuery = db
//       .select()
//       .from(contacts)
//       .where(whereClause)
//       .limit(pageSize)
//       .offset(offset);
//     const data = await dataQuery;

//     // Response
//     res.json({
//       data,
//       pagination: {
//         page: currentPage,
//         limit: pageSize,
//         count: data.length,
//         total,
//         totalPages: Math.ceil(total / pageSize),
//       },
//     });
//   }
// );



export const getContactsWithPagination = asyncHandler(
  async (req: RequestWithChannel, res: Response) => {
    const { search, channelId, page = "1", limit = "10", group, status, createdBy } = req.query;

    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const offset = (currentPage - 1) * pageSize;

    const conditions = [];

    // Filter by channelId
    if (channelId && typeof channelId === "string") {
      conditions.push(eq(contacts.channelId, channelId));
    }

    // Filter by createdBy
    if (createdBy && typeof createdBy === "string") {
      conditions.push(eq(contacts.createdBy, createdBy));
    }

    // Search filter
    if (search && typeof search === "string") {
      const searchTerm = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(contacts.name, searchTerm),
          ilike(contacts.email, searchTerm),
          ilike(contacts.phone, `%${search}%`)
        )
      );
    }

    // Group filter (jsonb array)
    if (group && typeof group === "string") {
      const groupList = group.split(',').map(g => g.trim());
      if (groupList.length > 0) {
        const jsonArray = JSON.stringify(groupList);
        conditions.push(
          sql`${contacts.groups} @> ${sql.raw(`'${jsonArray}'::jsonb`)}`
        );
      }
    }

    // Status filter
    if (status && typeof status === "string") {
      conditions.push(eq(contacts.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(whereClause);
    const totalResult = await totalQuery;
    const total = totalResult[0]?.count ?? 0;

    // Fetch data with createdByName
    const dataQuery = db
      .select({
        id: contacts.id,
        channelId: contacts.channelId,
        name: contacts.name,
        phone: contacts.phone,
        email: contacts.email,
        groups: contacts.groups,
        tags: contacts.tags,
        status: contacts.status,
        source: contacts.source,
        lastContact: contacts.lastContact,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
        createdBy: contacts.createdBy,

        createdByName: sql<string>`
      CONCAT(
        COALESCE(${users.firstName}, ''), ' ', COALESCE(${users.lastName}, '')
      )
    `.as("createdByName"),
      })
      .from(contacts)
      .leftJoin(users, eq(users.id, sql`${contacts.createdBy}::text`))
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);


    const data = await dataQuery;

    res.json({
      data,
      pagination: {
        page: currentPage,
        limit: pageSize,
        count: data.length,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  }
);



const getContactsWithPaginationOld = asyncHandler(
  async (req: RequestWithChannel, res: Response) => {
    const { search, channelId, page = "1", limit = "10", group, status, createdBy } = req.query;

    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const offset = (currentPage - 1) * pageSize;

    const conditions = [];

    // Filter by channelId
    if (channelId && typeof channelId === "string") {
      conditions.push(eq(contacts.channelId, channelId));
    }

    //export Filter by createdBy (VERY IMPORTANT UPDATE)
    if (createdBy && typeof createdBy === "string") {
      conditions.push(eq(contacts.createdBy, createdBy));
    }

    // Search filter
    if (search && typeof search === "string") {
      const searchTerm = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(contacts.name, searchTerm),
          ilike(contacts.email, searchTerm),
          ilike(contacts.phone, `%${search}%`)
        )
      );
    }

    // Group filter (jsonb array)
    if (group && typeof group === "string") {
      const groupList = group.split(',').map(g => g.trim());
      if (groupList.length > 0) {
        const jsonArray = JSON.stringify(groupList);
        conditions.push(
          sql`${contacts.groups} @> ${sql.raw(`'${jsonArray}'::jsonb`)}`
        );
      }
    }

    // Status filter
    if (status && typeof status === "string") {
      conditions.push(eq(contacts.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(whereClause);
    const totalResult = await totalQuery;
    const total = totalResult[0]?.count ?? 0;

    // Fetch data
    const dataQuery = db
      .select()
      .from(contacts)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset);

    const data = await dataQuery;

    res.json({
      data,
      pagination: {
        page: currentPage,
        limit: pageSize,
        count: data.length,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  }
);



export const getContact = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const contact = await storage.getContact(id);
  if (!contact) {
    throw new AppError(404, "Contact not found");
  }
  res.json(contact);
});

export const createContact = asyncHandler(
  async (req: RequestWithChannel, res: Response) => {
    const validatedContact = insertContactSchema.parse(req.body);
    const createdBy = (req.session as any).user.id;

    // Use channelId from query or active channel
    // let channelId = req.query.channelId as string | undefined;
    let channelId = (req.body.channelId as string) || undefined;

    if (!channelId) {
      const activeChannel = await storage.getActiveChannel();
      if (activeChannel) {
        channelId = activeChannel.id;
      }
    }

    // ✅ If no channel found, throw error
    if (!channelId) {
      return res
        .status(400)
        .json({ error: "You must create a channel before adding a contact." });
    }

    // Check for duplicate phone number
    const existingContacts = channelId
      ? await storage.getContactsByChannel(channelId)
      : await storage.getContacts();

    const duplicate = existingContacts.find(
      (c) => c.phone === validatedContact.phone
    );
    if (duplicate) {
      throw new AppError(409, "This phone number is already exists.");
    }

    const contact = await storage.createContact({
      ...validatedContact,
      channelId,
      createdBy,
    });

    res.json(contact);
  }
);

export const updateContact = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const contact = await storage.updateContact(id, req.body);
    if (!contact) {
      throw new AppError(404, "Contact not found");
    }
    res.json(contact);
  }
);

export const deleteContact = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const success = await storage.deleteContact(id);
    if (!success) {
      throw new AppError(404, "Contact not found");
    }
    res.status(204).send();
  }
);


export const deleteBulkContacts = asyncHandler(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError(400, "No contact IDs provided");
    }

    const result = await db
      .delete(contacts)
      .where(inArray(contacts.id, ids));

    // Optionally check how many rows were affected
    if (result.rowCount === 0) {
      throw new AppError(404, "No contacts found to delete");
    }

    res.status(204).send();
  }
);

export const importContacts = asyncHandler(
  async (req: RequestWithChannel, res: Response) => {
    const { contacts, channelId: bodyChannelId } = req.body;

    if (!Array.isArray(contacts)) {
      throw new AppError(400, "Contacts must be an array");
    }

    // Use channelId from body, query or active channel
    let channelId =
      bodyChannelId || (req.query.channelId as string | undefined);
    if (!channelId) {
      const activeChannel = await storage.getActiveChannel();
      if (activeChannel) {
        channelId = activeChannel.id;
      }
    }

    // Get existing contacts for duplicate check
    const existingContacts = channelId
      ? await storage.getContactsByChannel(channelId)
      : await storage.getContacts();

    const existingPhones = new Set(existingContacts.map((c) => c.phone));

    const createdContacts = [];
    const duplicates = [];
    const errors = [];

    for (const contact of contacts) {
      try {
        // Check for duplicate phone number
        if (existingPhones.has(contact.phone)) {
          duplicates.push({
            contact,
            reason: "Phone number already exists",
          });
          continue;
        }

        const validatedContact = insertContactSchema.parse({
          ...contact,
          channelId,
          createdBy: (req.session as any).user.id,
        });
        const created = await storage.createContact(validatedContact);
        createdContacts.push(created);
        existingPhones.add(created.phone); // Add to set to catch duplicates within the import
      } catch (error) {
        errors.push({
          contact,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    res.json({
      created: createdContacts.length,
      duplicates: duplicates.length,
      failed: errors.length,
      total: contacts.length,
      details: {
        created: createdContacts.length,
        duplicates: duplicates.slice(0, 10), // Limit to first 10
        errors: errors.slice(0, 10), // Limit to first 10
      },
    });
  }
);
