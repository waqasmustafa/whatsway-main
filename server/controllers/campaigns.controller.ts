import { asyncHandler } from "../utils/async-handler";
import { storage } from "../storage";
import { z } from "zod";
import type { Contact } from "@shared/schema";
import { randomUUID } from "crypto";
import { WhatsAppApiService } from "../services/whatsapp-api";

const createCampaignSchema = z.object({
  channelId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  campaignType: z.enum(["contacts", "csv", "api"]),
  type: z.enum(["marketing", "transactional"]),
  apiType: z.enum(["cloud_api", "marketing_messages", "mm_lite"]),
  templateId: z.string(),
  templateName: z.string(),
  templateLanguage: z.string(),
  variableMapping: z.record(z.string()).optional(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  contactGroups: z.array(z.string()).optional(),
  csvData: z.array(z.any()).optional(),
  recipientCount: z.number(),
  autoRetry: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  status: z.string(),
});

export const campaignsController = {
  // Get all campaigns
  getCampaigns: asyncHandler(async (req, res) => {
    const channelId = req.headers["x-channel-id"] as string;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const campaigns = channelId
      ? await storage.getCampaignsByChannel(channelId, page, limit)
      : await storage.getCampaigns(page, limit);
    res.json(campaigns);
  }),

  // Get campaign by ID
  getCampaign: asyncHandler(async (req, res) => {
    const campaign = await storage.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json(campaign);
  }),


  getCampaignByUserID: asyncHandler(async (req, res) => {
    const { userId } = req.body;

    const page = Number(req.body.page) || 1;
    const limit = Number(req.body.limit) || 10;

    const campaign = await storage.getCampaignByUserId(userId, page, limit);

    res.json(campaign);
  }),



  // Create new campaign
  createCampaign: asyncHandler(async (req, res) => {
    const data = createCampaignSchema.parse(req.body);

    // Validate user
    if (!req.user?.id) {
      return res.status(401).json({ status: "error", message: "User not authenticated" });
    }

    const createdBy = req.user.id;
    console.log("req.user:", req.user);


    // Generate API key for API campaigns
    let apiKey = undefined;
    let apiEndpoint = undefined;
    if (data.campaignType === "api") {
      apiKey = `ww_${randomUUID().replace(/-/g, "")}`;
      apiEndpoint = `${req.protocol}://${req.get(
        "host"
      )}/api/campaigns/send/${apiKey}`;
    }

    // Process CSV data and create contacts if needed
    let contactIds: string[] = [];
    if (data.campaignType === "csv" && data.csvData) {
      for (const row of data.csvData) {
        if (row.phone) {
          // Check if contact exists
          let contact = await storage.getContactByPhone(row.phone);
          if (!contact) {
            // Create new contact
            contact = await storage.createContact({
              channelId: data.channelId,
              name: row.name || row.phone,
              phone: row.phone,
              email: row.email || null,
              groups: ["csv_import"],
              tags: [`campaign_${data.name}`],
            });
          }
          contactIds.push(contact.id);
        }
      }
    } else if (data.campaignType === "contacts") {
      contactIds = data.contactGroups || [];
    }

    // Calculate recipient count
    const recipientCount = contactIds.length;


    const campaign = await storage.createCampaign({
      ...data,
      apiKey,
      apiEndpoint,
      recipientCount,
      contactGroups: contactIds,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      createdBy
    });

    // If status is active and not scheduled, start campaign immediately
    if (data.status === "active" && !data.scheduledAt) {
      startCampaignExecution(campaign.id);
    }

    res.json(campaign);
  }),

  // Update campaign status
  updateCampaignStatus: asyncHandler(async (req, res) => {
    const { status } = updateStatusSchema.parse(req.body);
    const campaign = await storage.updateCampaign(req.params.id, { status });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // If reactivating a campaign, start execution
    if (status === "active") {
      startCampaignExecution(campaign.id);
    }

    res.json(campaign);
  }),

  // Delete campaign
  deleteCampaign: asyncHandler(async (req, res) => {
    const deleted = await storage.deleteCampaign(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json({ success: true });
  }),

  // Start campaign execution
  startCampaign: asyncHandler(async (req, res) => {
    const campaign = await storage.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    startCampaignExecution(campaign.id);
    res.json({ success: true, message: "Campaign started" });
  }),

  // Get campaign analytics
  getCampaignAnalytics: asyncHandler(async (req, res) => {
    const campaign = await storage.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (!campaign.deliveredCount) {
      return res
        .status(400)
        .json({ error: "No messages delivered yet for this campaign" });
    }
    if (!campaign.sentCount) {
      return res
        .status(400)
        .json({ error: "No messages sent yet for this campaign" });
    }
    if (!campaign.recipientCount) {
      return res
        .status(400)
        .json({ error: "No recipients found for this campaign" });
    }
    if (!campaign.readCount) {
      return res
        .status(400)
        .json({ error: "No messages read yet for this campaign" });
    }

    // Return campaign metrics
    res.json({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      metrics: {
        recipientCount: campaign.recipientCount,
        sentCount: campaign.sentCount,
        deliveredCount: campaign.deliveredCount,
        readCount: campaign.readCount,
        repliedCount: campaign.repliedCount,
        failedCount: campaign.failedCount,
        deliveryRate: campaign.sentCount
          ? ((campaign.deliveredCount / campaign.recipientCount) * 100).toFixed(
            2
          )
          : 0,
        readRate: campaign.deliveredCount
          ? ((campaign.readCount / campaign.deliveredCount) * 100).toFixed(2)
          : 0,
      },
      createdAt: campaign.createdAt,
      completedAt: campaign.completedAt,
    });
  }),

  // API campaign endpoint
  sendApiCampaign: asyncHandler(async (req, res) => {
    const { apiKey } = req.params;

    // Find campaign by API key
    const campaigns = await storage.getCampaigns();
    const campaign = campaigns.find((c) => c.apiKey === apiKey);

    if (!campaign || campaign.campaignType !== "api") {
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (campaign.status !== "active") {
      return res.status(400).json({ error: "Campaign is not active" });
    }

    // Get channel
    if (!campaign.channelId) {
      return res
        .status(400)
        .json({ error: "Channel ID is missing in campaign" });
    }
    const channel = await storage.getChannel(campaign.channelId);
    if (!channel) {
      return res.status(400).json({ error: "Channel not found" });
    }

    // Parse request body
    const { phone, variables = {} } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Get template

    if (!campaign.templateId) {
      return res
        .status(400)
        .json({ error: "Template ID is missing in campaign" });
    }
    const template = await storage.getTemplate(campaign.templateId);
    if (!template) {
      return res.status(400).json({ error: "Template not found" });
    }

    // Prepare template parameters
    const templateParams: any[] = [];
    if (
      campaign.variableMapping &&
      typeof campaign.variableMapping === "object" &&
      !Array.isArray(campaign.variableMapping) &&
      Object.keys(campaign.variableMapping).length > 0
    ) {
      const mapping = campaign.variableMapping as Record<string, string>;

      Object.keys(mapping).forEach((key) => {
        const fieldName = mapping[key];
        const value = variables?.[fieldName] || "";
        templateParams.push({ type: "text", text: value });
      });
    }

    try {
      // Send template message - always use MM Lite for marketing campaigns
      const response = await WhatsAppApiService.sendTemplateMessage(
        channel,
        phone,
        template.name,
        templateParams.map((p) => p.text),
        template.language || "en_US",
        true // Always use MM Lite
      );
      const messageId = response.messages?.[0]?.id || `msg_${randomUUID()}`;

      // Create message log entry

      // Conversation / contact logic (same as before)
      let conversation = await storage.getConversationByPhone(phone);
      if (!conversation) {
        let contact = await storage.getContactByPhone(phone);
        if (!contact) {
          contact = await storage.createContact({
            name: phone,
            phone: phone,
            channelId: channel.id,
          });
        }
        conversation = await storage.createConversation({
          contactId: contact.id,
          contactPhone: phone,
          contactName: contact.name || phone,
          channelId: channel.id,
          unreadCount: 0,
        });
      }

      const createdMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: template.body || "",
        status: "sent",
        whatsappMessageId: messageId,
        messageType: "text",
        metadata: {},
      });

      // await storage.createMessage({
      //   conversationId: null, // API messages may not have conversation
      //   to: phone,
      //   from: channel.phoneNumber,
      //   type: "template",
      //   content: JSON.stringify({
      //     templateId: template.id,
      //     templateName: template.name,
      //     parameters: templateParams,
      //   }),
      //   status: "sent",
      //   direction: "outbound",
      //   whatsappMessageId: messageId,
      //   timestamp: new Date(),
      //   campaignId: campaign.id,
      // });

      // Update campaign stats
      await storage.updateCampaign(campaign.id, {
        sentCount: (campaign.sentCount || 0) + 1,
      });

      res.json({
        success: true,
        messageId,
        message: "Message sent successfully",
      });
    } catch (error: any) {
      // Update failed count
      await storage.updateCampaign(campaign.id, {
        failedCount: (campaign.failedCount || 0) + 1,
      });

      res.status(500).json({
        error: "Failed to send message",
        details: error.message,
      });
    }
  }),
};

// Helper function to execute campaign
async function startCampaignExecution(campaignId: string) {
  console.log("Starting campaign execution for:", campaignId);

  const campaign = await storage.getCampaign(campaignId);
  if (!campaign || campaign.status !== "active") {
    console.log("Campaign not found or not active:", campaignId);
    return;
  }

  if (!campaign.channelId) {
    console.error("Channel ID is missing for campaign:", campaignId);
    return;
  }

  const channel = await storage.getChannel(campaign.channelId);
  if (!channel) {
    console.error("Channel not found for campaign:", campaignId);
    return;
  }

  if (!campaign.templateId) {
    console.error("Template ID is missing for campaign:", campaignId);
    return;
  }
  const template = await storage.getTemplate(campaign.templateId);
  if (!template) {
    console.error("Template not found for campaign:", campaignId);
    return;
  }

  console.log("Campaign details:", {
    campaignId,
    channelId: channel.id,
    templateId: template.id,
    templateName: template.name,
    campaignType: campaign.campaignType,
    contactGroups: campaign.contactGroups,
  });

  // Get contacts for the campaign
  let contacts: Contact[] = [];
  if (campaign.campaignType === "contacts" && campaign.contactGroups) {
    for (const contactId of campaign.contactGroups) {
      const contact = await storage.getContact(contactId);
      if (contact) {
        contacts.push(contact);
      }
    }
  }

  console.log(`Found ${contacts.length} contacts for campaign`);

  // Process each contact
  for (const contact of contacts) {
    // Add small delay between messages to prevent rate limiting and server hangs
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      console.log(`Processing contact: ${contact.name} (${contact.phone})`);

      // Prepare template parameters based on variable mapping
      const templateParams: any[] = [];
      if (
        campaign.variableMapping &&
        typeof campaign.variableMapping === "object" &&
        !Array.isArray(campaign.variableMapping)
      ) {
        Object.entries(campaign.variableMapping).forEach(([key, fieldName]) => {
          let value = "";

          if (fieldName === "name") value = contact.name;
          else if (fieldName === "phone") value = contact.phone;
          else if (fieldName === "email") value = contact.email || "";

          templateParams.push({ type: "text", text: value });
        });
      }

      // console.log("Sending message with params:", {
      //   phone: contact.phone,
      //   template: template.name,
      //   parameters: templateParams.map(p => p.text)
      // });

      // Send template message - always use MM Lite for marketing campaigns
      const response = await WhatsAppApiService.sendTemplateMessage(
        channel,
        contact.phone,
        template.name,
        templateParams.map((p) => p.text),
        template.language || "en_US",
        true // Always use MM Lite
      );
      const messageId = response.messages?.[0]?.id || `msg_${randomUUID()}`;

      // console.log( "Message sent, response:",{
      //   sentCount: (campaign.sentCount || 0) + 1,
      // })

      // Create message log entry


      // Conversation / contact logic (same as before)
      let conversation = await storage.getConversationByPhone(contact.phone);
      if (!conversation) {
        conversation = await storage.createConversation({
          contactId: contact.id,
          contactPhone: contact.phone,
          contactName: contact.name || contact.phone,
          channelId: channel.id,
          unreadCount: 0,
        });
      }

      const createdMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: template.body || "",
        status: "sent",
        whatsappMessageId: messageId,
        messageType: "text",
        metadata: {},
      });

      // const sendMsg = await storage.createMessage({
      //   conversationId: null, // Campaign messages may not have conversation
      //   to: contact.phone,
      //   from: channel.phoneNumber,
      //   type: "template",
      //   content: JSON.stringify({
      //     templateId: template.id,
      //     templateName: template.name,
      //     parameters: templateParams,
      //   }),
      //   status: "sent",
      //   direction: "outbound",
      //   whatsappMessageId: messageId,
      //   timestamp: new Date(),
      //   campaignId: campaignId,
      // });
      // console.log("Message logged:", sendMsg);
      // Update sent count
      const updateCampaign = await storage.updateCampaign(campaignId, {
        sentCount: (campaign.sentCount || 0) + 1,
      });
      console.log("Campaign updated:", updateCampaign);
    } catch (error) {
      console.error(`Failed to send message to ${contact.phone}:`, error);
      // Update failed count
      await storage.updateCampaign(campaignId, {
        failedCount: (campaign.failedCount || 0) + 1,
      });
    }
  }

  // Mark campaign as completed if all messages are processed
  const updatedCampaign = await storage.getCampaign(campaignId);
  if (
    updatedCampaign &&
    (updatedCampaign.sentCount || 0) + (updatedCampaign.failedCount || 0) >=
    (updatedCampaign.recipientCount || 0)
  ) {
    await storage.updateCampaign(campaignId, {
      status: "completed",
      completedAt: new Date(),
    });
  }
}
