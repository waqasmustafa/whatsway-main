import { IStorage } from "./storage";
import { UserRepository } from "./repositories/user.repository";
import { ContactRepository } from "./repositories/contact.repository";
import { CampaignRepository } from "./repositories/campaign.repository";
import { ChannelRepository } from "./repositories/channel.repository";
import { TemplateRepository } from "./repositories/template.repository";
import { ConversationRepository } from "./repositories/conversation.repository";
import { MessageRepository } from "./repositories/message.repository";
import { AutomationRepository } from "./repositories/automation.repository";
import { AnalyticsRepository } from "./repositories/analytics.repository";
import { WebhookConfigRepository } from "./repositories/webhook-config.repository";
import { MessageQueueRepository } from "./repositories/message-queue.repository";
import { ApiLogRepository } from "./repositories/api-log.repository";
import { WhatsappChannelRepository } from "./repositories/whatsapp-channel.repository";
import { getActivePaidUsersCount } from "./controllers/subscriptions.controller";

import {
  type User,
  type InsertUser,
  type Contact,
  type InsertContact,
  type Campaign,
  type InsertCampaign,
  type Channel,
  type InsertChannel,
  type Template,
  type InsertTemplate,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Automation,
  type InsertAutomation,
  type Analytics,
  type InsertAnalytics,
  type WhatsappChannel,
  type InsertWhatsappChannel,
  type WebhookConfig,
  type InsertWebhookConfig,
  type MessageQueue,
  type InsertMessageQueue,
  type ApiLog,
  type InsertApiLog,
  type Site,
  type InsertSite,
  sites,
} from "@shared/schema";
import { db } from "./db";
import { desc, eq } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  private userRepo = new UserRepository();
  private contactRepo = new ContactRepository();
  private campaignRepo = new CampaignRepository();
  private channelRepo = new ChannelRepository();
  private templateRepo = new TemplateRepository();
  private conversationRepo = new ConversationRepository();
  private messageRepo = new MessageRepository();
  private automationRepo = new AutomationRepository();
  private analyticsRepo = new AnalyticsRepository();
  private webhookConfigRepo = new WebhookConfigRepository();
  private messageQueueRepo = new MessageQueueRepository();
  private apiLogRepo = new ApiLogRepository();
  private whatsappChannelRepo = new WhatsappChannelRepository();




  // Sites

  async getSite(id: string): Promise<Site | undefined> {
    console.log("check IDDDDDDDDDDDd", id);
    const [site] = await db.select().from(sites).where(eq(sites.id, id));
    console.log("check siteeeeeeeeee", site);
    return site || undefined;
  }

  async getSites(): Promise<Site | undefined> {
    const [site] = await db
      .select()
      .from(sites)

    return site || [];
  }

  async getSitesByChannel(channelId: string): Promise<Site[]> {
    return await db.select().from(sites).where(eq(sites.channelId, channelId));
  }

  async createSite(insertSite: InsertSite): Promise<Site> {
    // Generate a unique widget code
    const widgetCode = `wc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const [site] = await db
      .insert(sites)
      .values({ ...insertSite, widgetCode })
      .returning();
    return site;
  }

  async updateSite(id: string, data: Partial<InsertSite>): Promise<Site> {
    const [site] = await db.update(sites).set(data).where(eq(sites.id, id)).returning();
    return site;
  }


  // Returns statistics of message queue
  async getMessageQueueStats(): Promise<Record<string, number>> {
    return { queued: 0, processing: 0, sent: 0, delivered: 0, failed: 0 };
  }

  // Returns queued messages
  async getQueuedMessages(limit: number = 10): Promise<MessageQueue[]> {
    return [];
  }

  // Returns message queue object (stub)
  async getMessageQueue(): Promise<MessageQueue> {
    return {} as MessageQueue;
  }

  // Logs API request
  async logApiRequest(log: InsertApiLog): Promise<ApiLog | null> {
    return null;
  }

  async getAutomationByChannel(channelId: string): Promise<{ id: string; name: string; createdAt: Date | null; updatedAt: Date | null; channelId: string | null; description: string | null; trigger: string; triggerConfig: unknown; status: string | null; executionCount: number | null; lastExecutedAt: Date | null; createdBy: string | null; }[]> {
    // implement your logic
    return [];
  }


  async getWhatsappChannels(): Promise<WhatsappChannel[]> {
    // implement your logic
    return [];
  }

  async deleteWhatsappChannel(id: string): Promise<void> {
    await this.whatsappChannelRepo.delete(id);
  }


  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.userRepo.getById(id);
  }

  async getPermissions(id: string): Promise<string[] | undefined> {
    return this.userRepo.getByPermissions(id); // this now makes sense
  }


  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.userRepo.getByUsername(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.userRepo.create(insertUser);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepo.getAll();
  }

  // Contacts
  async getContacts(): Promise<Contact[]> {
    return this.contactRepo.getAll();
  }


  async getContactsByUser(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: Contact[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }> {
    return this.contactRepo.getContactsByUserId(userId, page, limit);
  }



  async getContactsByChannel(channelId: string): Promise<Contact[]> {
    return this.contactRepo.getByChannel(channelId);
  }

  async getContactsByTenant(tenantId: string): Promise<Contact[]> {
    return this.contactRepo.getContactsByTenant(tenantId);
  }
  async getContactByEmail(email: string): Promise<Contact[]> {
    return this.contactRepo.getContactByEmail(email);
  }
  async getContactsByPhone(phone: string): Promise<Contact[]> {
    return this.contactRepo.getContactByPhone(phone);
  }
  async searchContactsByChannel(channelId: string): Promise<Contact[]> {
    return this.contactRepo.getByChannel(channelId);
  }


  async getContact(id: string): Promise<Contact | undefined> {
    return this.contactRepo.getById(id);
  }

  async getContactByPhone(phone: string): Promise<Contact | undefined> {
    return this.contactRepo.getByPhone(phone);
  }

  // async createContact(insertContact: InsertContact): Promise<Contact> {
  //   return this.contactRepo.create(insertContact);
  // }


  async createContact(insertContact: InsertContact & { channelId?: string }): Promise<Contact> {
    if (!insertContact.channelId) {
      throw new Error("Cannot create contact without a channel. Please create a channel first.");
    }

    return this.contactRepo.create(insertContact);
  }


  async updateContact(
    id: string,
    contact: Partial<Contact>
  ): Promise<Contact | undefined> {
    return this.contactRepo.update(id, contact);
  }

  async deleteContact(id: string): Promise<boolean> {
    return this.contactRepo.delete(id);
  }

  async searchContacts(query: string): Promise<Contact[]> {
    return this.contactRepo.search(query);
  }

  async createBulkContacts(
    insertContacts: InsertContact[]
  ): Promise<Contact[]> {
    return this.contactRepo.createBulk(insertContacts);
  }

  async checkExistingPhones(
    phones: string[],
    channelId: string
  ): Promise<string[]> {
    return this.contactRepo.checkExistingPhones(phones, channelId);
  }

  // Campaigns
  async getCampaigns(
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: Campaign[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.campaignRepo.getAll(page, limit);
  }


  async getCampaignsByChannel(
    channelId: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.campaignRepo.getByChannel(channelId, page, limit);
  }


  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaignRepo.getById(id);
  }

  async getCampaignByUserId(userId: string, page: number = 1, limit: number = 10): Promise<Campaign | undefined> {
    return this.campaignRepo.getCampaignByUserId(userId, page, limit);
  }

  async createCampaign(insertCampaign: InsertCampaign & { createdBy: string }): Promise<Campaign> {
    return this.campaignRepo.create(insertCampaign);
  }

  async updateCampaign(
    id: string,
    campaign: Partial<Campaign>
  ): Promise<Campaign | undefined> {
    return this.campaignRepo.update(id, campaign);
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return this.campaignRepo.delete(id);
  }

  // Channels
  async getChannels(): Promise<Channel[]> {
    return this.channelRepo.getAll();
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    return this.channelRepo.getById(id);
  }


  async getChannelsByUserId(userId: string): Promise<Channel[]> {
    return this.channelRepo.getAllByUserId(userId);
  }


  async getActiveChannelByUserId(userId: string): Promise<Channel | undefined> {
    return this.channelRepo.getActiveByUserId(userId);
  }

  async getChannelsByUser(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: Channel[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.channelRepo.getByUser(userId, page, limit);
  }




  async getChannelByPhoneNumberId(
    phoneNumberId: string
  ): Promise<Channel | undefined> {
    return this.channelRepo.getByPhoneNumberId(phoneNumberId);
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    return this.channelRepo.create(insertChannel);
  }

  async updateChannel(
    id: string,
    channel: Partial<Channel>
  ): Promise<Channel | undefined> {
    return this.channelRepo.update(id, channel);
  }

  async deleteChannel(id: string): Promise<boolean> {
    return this.channelRepo.delete(id);
  }

  async getActiveChannel(): Promise<Channel | undefined> {
    return this.channelRepo.getActive();
  }

  // Templates
  // async getTemplates(): Promise<Template[]> {
  //   return this.templateRepo.getAll();
  // }

  // database-storage.ts

  async getTemplates(page = 1, limit = 10): Promise<{
    data: Template[];
    pagination: { total: number; totalPages: number; page: number; limit: number };
  }> {
    const result = await this.templateRepo.getAll(page, limit);
    return {
      data: result.data,
      pagination: result.pagination,
    };
  }


  async getTemplatesByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: Template[]; total: number; page: number; limit: number }> {
    return this.templateRepo.getTemplateByUserID(userId, page, limit);
  }



  async getTemplatesByChannelAndUser(channelId: string, userId: string): Promise<Template[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    // For team members, use their creator's ID for ownership check
    const effectiveUserId = user.role === "team" ? user.createdBy : userId;

    const channel = await this.getChannel(channelId);

    // Check ownership: current user (or their admin) must own the channel, 
    // unless the current user is a superadmin
    if (!channel || (channel.createdBy !== effectiveUserId && user.role !== 'superadmin')) {
      return [];
    }

    const allTemplatesResult = await this.templateRepo.getAll(1, 1000);
    const allTemplates = allTemplatesResult.data;

    // Return templates for this channel, sorted by creation date
    return allTemplates
      .filter(template => template.channelId === channelId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }





  async getTemplatesByChannelOLd(channelId: string): Promise<Template[]> {
    return this.templateRepo.getByChannel(channelId);
  }

  async getTemplatesByChannel(
    channelId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: Template[]; total: number }> {
    return this.templateRepo.getByChannel(channelId, page, limit);
  }


  async getTemplatesByName(name: string): Promise<Template[]> {
    const templates = await this.templateRepo.getByName(name);

    // if undefined, default to empty array
    return templates ? (Array.isArray(templates) ? templates : [templates]) : [];
  }


  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templateRepo.getById(id);
  }

  async createTemplate(insertTemplate: InsertTemplate & { createdBy: string }): Promise<Template> {
    return this.templateRepo.create(insertTemplate);
  }

  async updateTemplate(
    id: string,
    template: Partial<Template>
  ): Promise<Template | undefined> {
    return this.templateRepo.update(id, template);
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templateRepo.delete(id);
  }

  async deleteTemplatesBulk(ids: string[]): Promise<boolean> {
    return this.templateRepo.deleteBulk(ids);
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return this.conversationRepo.getAll();
  }

  async getConversationBySessionId(sessionId: string): Promise<Conversation[]> {
    return this.conversationRepo.getBySessionId(sessionId);
  }
  async getConversationsByChannel(channelId: string): Promise<Conversation[]> {
    return this.conversationRepo.getByChannel(channelId);
  }
  async getConversationsByContact(contactId: string): Promise<Conversation[]> {
    return this.conversationRepo.getByContact(contactId);
  }

  async getConversationsNew(): Promise<Conversation[]> {
    return this.conversationRepo.getAllNew();
  }

  async getConversationsByChannelNew(
    channelId: string
  ): Promise<Conversation[]> {
    return this.conversationRepo.getByChannelNew(channelId);
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversationRepo.getById(id);
  }


  async getConversationByPhone(
    phone: string
  ): Promise<Conversation | undefined> {
    return this.conversationRepo.getByPhone(phone);
  }

  async createConversation(
    insertConversation: InsertConversation
  ): Promise<Conversation> {
    return this.conversationRepo.create(insertConversation);
  }

  async updateConversation(
    id: string,
    conversation: Partial<Conversation>
  ): Promise<Conversation | undefined> {
    return this.conversationRepo.update(id, conversation);
  }

  async deleteConversation(id: string): Promise<boolean> {
    return this.conversationRepo.delete(id);
  }

  async getUnreadConversationsCount(): Promise<number> {
    return this.conversationRepo.getUnreadCount();
  }

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return this.messageRepo.getByConversation(conversationId);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    return this.messageRepo.create(insertMessage);
  }

  async updateMessage(
    id: string,
    message: Partial<Message>
  ): Promise<Message | undefined> {
    return this.messageRepo.update(id, message);
  }

  async getMessageByWhatsAppId(
    whatsappMessageId: string
  ): Promise<Message | undefined> {
    return this.messageRepo.getByWhatsAppId(whatsappMessageId);
  }

  async getConversationMessages(conversationId: string): Promise<Message | undefined> {
    return this.messageRepo.getByConversation(conversationId);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messageRepo.getById(id);
  }

  // Automations
  async getAutomations(): Promise<Automation[]> {
    // Get all automations by not filtering by channel
    return this.automationRepo.findByChannel("");
  }

  async getAutomationsByChannel(channelId: string): Promise<Automation[]> {
    return this.automationRepo.findByChannel(channelId);
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    return this.automationRepo.findById(id);
  }

  async createAutomation(
    insertAutomation: InsertAutomation
  ): Promise<Automation> {
    return this.automationRepo.create(insertAutomation);
  }

  async updateAutomation(
    id: string,
    automation: Partial<InsertAutomation>
  ): Promise<Automation | undefined> {
    const result = await this.automationRepo.update(id, automation);
    return result || undefined;
  }

  async deleteAutomation(id: string): Promise<boolean> {
    await this.automationRepo.delete(id);
    return true;
  }

  // Analytics
  // async getAnalytics(days?: number): Promise<Analytics[]> {
  //   return this.analyticsRepo.getAnalytics(days);
  // }

  async createOrUpdateAnalytics(
    insertAnalytics: InsertAnalytics
  ): Promise<Analytics> {
    return this.analyticsRepo.createOrUpdate(insertAnalytics);
  }

  async deleteOldAnalytics(daysToKeep: number): Promise<void> {
    return this.analyticsRepo.deleteOldAnalytics(daysToKeep);
  }

  // WhatsApp Channels
  async getWhatsappChannel(
    channelId: string
  ): Promise<WhatsappChannel | undefined> {
    return this.whatsappChannelRepo.getByChannelId(channelId);
  }

  async createWhatsappChannel(
    insertChannel: InsertWhatsappChannel
  ): Promise<WhatsappChannel> {
    return this.whatsappChannelRepo.create(insertChannel);
  }

  async updateWhatsappChannel(
    id: string,
    channel: Partial<WhatsappChannel>
  ): Promise<WhatsappChannel | undefined> {
    return this.whatsappChannelRepo.update(id, channel);
  }

  // Webhook Configs
  async getWebhookConfigs(): Promise<WebhookConfig[]> {
    return this.webhookConfigRepo.getAll();
  }

  async getWebhookConfig(id: string): Promise<WebhookConfig | undefined> {
    return this.webhookConfigRepo.getById(id);
  }

  async createWebhookConfig(
    insertConfig: InsertWebhookConfig
  ): Promise<WebhookConfig> {
    return this.webhookConfigRepo.create(insertConfig);
  }

  async updateWebhookConfig(
    id: string,
    config: Partial<WebhookConfig>
  ): Promise<WebhookConfig | undefined> {
    return this.webhookConfigRepo.update(id, config);
  }

  async deleteWebhookConfig(id: string): Promise<boolean> {
    return this.webhookConfigRepo.delete(id);
  }

  // Message Queue
  async getMessageQueueByChannel(channelId: string): Promise<MessageQueue[]> {
    return this.messageQueueRepo.getByChannel(channelId);
  }

  async getPendingMessages(): Promise<MessageQueue[]> {
    return this.messageQueueRepo.getPending();
  }

  // async getMessagesToCheck(): Promise<MessageQueue[]> {
  //   return this.messageQueueRepo.getMessagesToCheck();
  // }

  async createMessageQueueItem(
    insertMessage: InsertMessageQueue
  ): Promise<MessageQueue> {
    return this.messageQueueRepo.create(insertMessage);
  }

  async createBulkMessageQueue(
    insertMessages: InsertMessageQueue[]
  ): Promise<MessageQueue[]> {
    return this.messageQueueRepo.createBulk(insertMessages);
  }

  async updateMessageQueueItem(
    id: string,
    message: Partial<MessageQueue>
  ): Promise<MessageQueue | undefined> {
    return this.messageQueueRepo.update(id, message);
  }

  async updateMessageQueueByWhatsAppId(
    whatsappMessageId: string,
    updates: Partial<MessageQueue>
  ): Promise<boolean> {
    return this.messageQueueRepo.updateByWhatsAppId(whatsappMessageId, updates);
  }

  async getMessageQueueByCampaign(campaignId: string): Promise<MessageQueue[]> {
    return this.messageQueueRepo.getByCampaign(campaignId);
  }

  // async getMessagesForRetry(limit: number = 100): Promise<MessageQueue[]> {
  //   return this.messageQueueRepo.getForRetry(limit);
  // }

  // API Logs
  async createApiLog(insertLog: InsertApiLog): Promise<ApiLog> {
    return this.apiLogRepo.create(insertLog);
  }
  async getApiLogs(channelId: string, limit: number): Promise<ApiLog[]> {
    return this.apiLogRepo.getByChannel(channelId, limit);
  }

  // Analytics
  async getAnalyticsByChannel(
    channelId: string,
    days?: number
  ): Promise<Analytics[]> {
    return this.analyticsRepo.getAnalyticsByChannel(channelId, days);
  }

  async getAnalytics(): Promise<Analytics[]> {
    return this.analyticsRepo.getAnalytics();
  }

  async createAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    return this.analyticsRepo.createOrUpdate(insertAnalytics);
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<any> {
    const { totalCount, todayCount, weekCount, lastWeekCount } =
      await this.contactRepo.getContactStats();
    const totalCampaigns = await this.campaignRepo
      .getAllCampaignCount()
    const totalTemplatesResult = await this.templateRepo.getAll(1, 1);
    const totalTemplates = totalTemplatesResult.pagination.total;
    const messageStats = await this.messageQueueRepo.getMessageStats();

    const totalUsers = await this.userRepo.getAll().then(users => users.filter(user => user.role === "admin").length);


    const totalActiveUsers = ((await this.userRepo.getAll().then(users => users.filter(user => user.role === "admin" && user.status === 'active'))).length)

    const totalBlockedUsers = ((await this.userRepo.getAll().then(users => users.filter(user => user.role === "admin" && user.status === 'blocked'))).length)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const users = await this.userRepo.getAll();
    const todaySignups = users.filter(user =>
      user.role === "admin" &&
      new Date(user.createdAt) >= today &&
      new Date(user.createdAt) < tomorrow
    ).length;

    const totalChannels = await this.channelRepo.getAll()
      .then((c) => c.length);

    const totalPaidUsers = await getActivePaidUsersCount()



    return {
      totalContacts: totalCount,
      todayContacts: todayCount,
      weekContacts: weekCount,
      lastWeekContacts: lastWeekCount,
      totalCampaigns,
      totalTemplates,
      totalUsers,
      totalActiveUsers,
      totalBlockedUsers,
      todaySignups,
      totalChannels,
      totalPaidUsers,
      ...messageStats,
    };
  }

  async getDashboardStatsByChannel(channelId: string, userId: string): Promise<any> {
    const { totalCount, todayCount, weekCount, lastWeekCount } =
      await this.contactRepo.getContactStats(channelId);
    const totalCampaignsResult = await this.campaignRepo.getByChannel(channelId, 1, 1);
    const totalCampaigns = totalCampaignsResult.total;

    const totalTemplatesResult = await this.templateRepo.getByChannel(channelId, 1, 1);
    const totalTemplates = totalTemplatesResult.total;
    const totalTemplatesByUserId = await this.templateRepo.getTemplateByUserID(userId);
    const messageStats = await this.messageQueueRepo.getMessageStatsByChannel(
      channelId
    );

    const totalChannels = await this.channelRepo.getTotalChannelsByUser(userId);

    const totalTeamMembers = await this.userRepo.getTeamUsersCountByCreator(userId)

    return {
      totalContacts: Number(totalCount),
      todayContacts: Number(todayCount),
      weekContacts: Number(weekCount),
      lastWeekContacts: Number(lastWeekCount),
      totalCampaigns,
      totalTemplates,
      totalChannels,
      totalTeamMembers,
      totalTemplatesByUserId: totalTemplatesByUserId.total,
      ...messageStats,
    };
  }
}
