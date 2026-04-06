import type { Request, Response } from 'express';
import { storage } from '../storage';
import { insertTemplateSchema } from '@shared/schema';
import { AppError, asyncHandler } from '../middlewares/error.middleware';
import { WhatsAppApiService } from '../services/whatsapp-api';
import type { RequestWithChannel } from '../middlewares/channel.middleware';

export const getTemplatesOld = asyncHandler(async (req: RequestWithChannel, res: Response) => {
  const channelId = req.query.channelId as string | undefined;
  console.log("Fetching templates for channelId:", channelId);
  const templates = channelId
    ? await storage.getTemplatesByChannel(channelId)
    : await storage.getTemplates();
  res.json(templates);
});


export const getTemplates = asyncHandler(
  async (req: RequestWithChannel, res: Response) => {
    const channelId = req.query.channelId as string | undefined;

    // Get page & limit from query params
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    let result;
    console.log("Fetching templates for channelId:", channelId, " page:", page, " limit:", limit);

    if (channelId) {
      // Agar channelId diya hai, to get paginated templates by channel
      result = await storage.getTemplatesByChannel(channelId, page, limit);
    } else {
      // Else, get all templates paginated
      result = await storage.getTemplates(page, limit);
    }

    // Return paginated response structure
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);



export const getTemplatesByUser = asyncHandler(async (req: RequestWithChannel, res: Response) => {
  const channelId = req.query.channelId as string;
  const userId = (req.session as any).user.id;
  console.log("🚀 Request Params - channelId:", channelId, "userId:", userId);
  if (!channelId) {
    return res.status(400).json({ message: "channelId is required" });
  }

  const templates = await storage.getTemplatesByChannelAndUser(channelId, userId);
  res.json(templates);
});



export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const template = await storage.getTemplate(id);
  if (!template) {
    throw new AppError(404, 'Template not found');
  }
  res.json(template);
});


export const getTemplateByUserID = asyncHandler(async (req: Request, res: Response) => {
  const { userId, page = 1, limit = 10 } = req.body;

  const templates = await storage.getTemplatesByUserId(userId, Number(page), Number(limit));

  if (!templates || templates.data.length === 0) {
    return res.status(404).json({ status: 'error', message: 'Template not found' });
  }

  res.json({
    status: 'success',
    data: templates.data,
    pagination: {
      page: templates.page,
      limit: templates.limit,
      total: templates.total,
      totalPages: Math.ceil(templates.total / templates.limit),
    },
  });
});


export const createTemplate = asyncHandler(async (req: RequestWithChannel, res: Response) => {
  console.log("Template creation request body:", JSON.stringify(req.body, null, 2));

  // 1️⃣ Validate request body
  const validatedTemplate = insertTemplateSchema.parse(req.body);
  console.log("Validated template buttons:", validatedTemplate.buttons);

  // 2️⃣ Get active channel if channelId not provided
  let channelId = validatedTemplate.channelId;
  if (!channelId) {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "User not authenticated");
    }
    const activeChannel = await storage.getActiveChannelByUserId(userId);
    if (!activeChannel) {
      throw new AppError(400, 'No active channel found. Please configure a channel first.');
    }
    channelId = activeChannel.id;
  }


  // 3️⃣ Get logged-in user id (assume auth middleware sets req.user)
  const createdBy = req.user?.id;
  if (!createdBy) {
    throw new AppError(401, "User not authenticated");
  }

  // 4️⃣ Create template in storage
  const template = await storage.createTemplate({
    ...validatedTemplate,
    channelId,
    status: "pending",
    createdBy,
  });

  // 5️⃣ Get channel details
  const channel = await storage.getChannel(channelId);
  if (!channel) {
    throw new AppError(400, 'Channel not found');
  }

  // 6️⃣ Format and submit to WhatsApp API
  try {
    const whatsappApi = new WhatsAppApiService(channel);
    const result = await whatsappApi.createTemplate(validatedTemplate);

    // Update template with WhatsApp ID
    if (result.id) {
      await storage.updateTemplate(template.id, {
        whatsappTemplateId: result.id,
        status: result.status || "pending"
      });
    }

    res.json(template);
  } catch (error) {
    console.error("WhatsApp API error:", error);
    res.json({
      ...template,
      warning: "Template created locally but failed to submit to WhatsApp"
    });
  }
});





export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = insertTemplateSchema.parse(req.body);

  // Get existing template
  const existingTemplate = await storage.getTemplate(id);
  if (!existingTemplate) {
    throw new AppError(404, 'Template not found');
  }

  // Update template in database
  const template = await storage.updateTemplate(id, validatedData);
  if (!template) {
    throw new AppError(404, 'Template not found');
  }

  // Get channel for WhatsApp API
  const channel = await storage.getChannel(template.channelId!);
  if (!channel) {
    throw new AppError(400, 'Channel not found');
  }

  // If template has a WhatsApp ID, delete the old one and create new one
  // (WhatsApp doesn't allow editing approved templates)
  if (existingTemplate.whatsappTemplateId) {
    try {
      const whatsappApi = new WhatsAppApiService(channel);

      // Delete old template
      await whatsappApi.deleteTemplate(existingTemplate.name);

      // Create new template with updated content
      const result = await whatsappApi.createTemplate(validatedData);

      // Update template with new WhatsApp ID
      if (result.id) {
        await storage.updateTemplate(template.id, {
          whatsappTemplateId: result.id,
          status: result.status || "pending"
        });
      }

      res.json({
        ...template,
        message: "Template updated and resubmitted to WhatsApp for approval"
      });
    } catch (error) {
      console.error("WhatsApp API error during update:", error);
      res.json({
        ...template,
        warning: "Template updated locally but failed to resubmit to WhatsApp"
      });
    }
  } else {
    // Template was never submitted to WhatsApp, just submit it now
    try {
      const whatsappApi = new WhatsAppApiService(channel);
      const result = await whatsappApi.createTemplate(validatedData);

      if (result.id) {
        await storage.updateTemplate(template.id, {
          whatsappTemplateId: result.id,
          status: result.status || "pending"
        });
      }

      res.json({
        ...template,
        message: "Template updated and submitted to WhatsApp for approval"
      });
    } catch (error) {
      console.error("WhatsApp API error:", error);
      res.json({
        ...template,
        warning: "Template updated locally but failed to submit to WhatsApp"
      });
    }
  }
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const success = await storage.deleteTemplate(id);
  if (!success) {
    throw new AppError(404, 'Template not found');
  }
  res.status(204).send();
});

export const deleteTemplatesBulk = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new AppError(400, 'Invalid or empty ids array');
  }

  const success = await storage.deleteTemplatesBulk(ids);
  if (!success) {
    throw new AppError(404, 'Templates not found or already deleted');
  }
  
  res.status(200).json({ success: true, message: `${ids.length} templates deleted` });
});

export const syncTemplates = asyncHandler(async (req: RequestWithChannel, res: Response) => {
  let channelId = req.body.channelId || req.query.channelId as string || req.channelId;

  if (!channelId) {
    const user = (req.session as any).user;
    const userId = user.role === "team" ? user.createdBy : user.id;

    // Get active channel for this user if not provided
    const activeChannel = await storage.getActiveChannelByUserId(userId);
    if (!activeChannel) {
      throw new AppError(400, 'No active channel found. Please configure a channel first.');
    }
    channelId = activeChannel.id;
  }


  const channel = await storage.getChannel(channelId);
  if (!channel) {
    throw new AppError(404, 'Channel not found');
  }

  try {
    const whatsappApi = new WhatsAppApiService(channel);
    const whatsappTemplates = await whatsappApi.getTemplates();

    const existingTemplatesResult = await storage.getTemplatesByChannel(channelId, 1, 1000); // Fetch up to 1000 to avoid sync duplicates
    const existingTemplates = existingTemplatesResult.data;
    const existingByName = new Map(existingTemplates.map(t => [`${t.name}_${t.language}`, t]));

    let updatedCount = 0;
    let createdCount = 0;
    const userId = (req.session as any).user.id;


    for (const waTemplate of whatsappTemplates) {
      const key = `${waTemplate.name}_${waTemplate.language}`;
      const existing = existingByName.get(key);

      // Extract body text from components
      let bodyText = '';
      if (waTemplate.components && Array.isArray(waTemplate.components)) {
        const bodyComponent = waTemplate.components.find((c: any) => c.type === 'BODY');
        if (bodyComponent && bodyComponent.text) {
          bodyText = bodyComponent.text;
        }
      }

      if (existing) {
        // Update existing template
        if (existing.status !== waTemplate.status || existing.whatsappTemplateId !== waTemplate.id) {
          await storage.updateTemplate(existing.id, {
            status: waTemplate.status,
            whatsappTemplateId: waTemplate.id,
            body: bodyText || existing.body
          });
          updatedCount++;
        }
      } else {
        // Create new template
        await storage.createTemplate({
          name: waTemplate.name,
          language: waTemplate.language,
          category: waTemplate.category || 'marketing',
          status: waTemplate.status,
          body: bodyText || `Template ${waTemplate.name}`,
          channelId: channelId,
          whatsappTemplateId: waTemplate.id,
          createdBy: userId
        });
        createdCount++;
      }
    }

    res.json({
      message: `Synced templates: ${createdCount} created, ${updatedCount} updated`,
      createdCount,
      updatedCount,
      synced: createdCount + updatedCount,
      totalTemplates: whatsappTemplates.length
    });

  } catch (error) {
    console.error("Template sync error:", error);
    throw new AppError(500, (error as Error).message || 'Failed to sync templates with WhatsApp');
  }
});

export const seedTemplates = asyncHandler(async (req: RequestWithChannel, res: Response) => {
  const channelId = req.query.channelId as string | undefined;

  // If no channelId in query, get active channel
  let finalChannelId = channelId;
  if (!finalChannelId) {
    const activeChannel = await storage.getActiveChannel();
    if (activeChannel) {
      finalChannelId = activeChannel.id;
    } else {
      throw new AppError(400, 'No active channel found. Please configure a channel first.');
    }
  }

  const templates = [
    {
      name: "hello_world",
      body: "Hello {{1}}! Welcome to our WhatsApp Business platform.",
      category: "utility" as const,
      language: "en",
      status: "pending",
      channelId: finalChannelId
    },
    {
      name: "order_confirmation",
      body: "Hi {{1}}, your order #{{2}} has been confirmed and will be delivered by {{3}}.",
      category: "utility" as const,
      language: "en",
      status: "pending",
      channelId: finalChannelId
    },
    {
      name: "appointment_reminder",
      body: "Hello {{1}}, this is a reminder about your appointment on {{2}} at {{3}}. Reply YES to confirm.",
      category: "utility" as const,
      language: "en",
      status: "pending",
      channelId: finalChannelId
    }
  ];

  const createdTemplates = await Promise.all(
    templates.map(template => storage.createTemplate(template))
  );

  res.json({ message: "Templates seeded successfully", templates: createdTemplates });
});