import type { Channel } from '@shared/schema';
import * as fs from "fs";
import path from "path";
import axios from 'axios';
import FormData from "form-data";
import type { Response } from "express";

interface WhatsAppTemplate {
  id: string;
  status: string;
  name: string;
  language: string;
  category: string;
  components: any[];
}

export class WhatsAppApiService {
  private channel: Channel;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(channel: Channel) {
    this.channel = channel;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
    this.headers = {
      'Authorization': `Bearer ${channel.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Static method for sending template messages
  static async sendTemplateMessage(
    channel: Channel,
    to: string,
    templateName: string,
    parameters: string[] = [],
    language: string = "en_US",
    isMarketing: boolean = true // Marketing messages use MM Lite API
  ): Promise<any> {
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    const baseUrl = `https://graph.facebook.com/${apiVersion}`;

    // Format phone number
    const phoneNumber = to.replace(/\D/g, '');
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

    const body = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: parameters.length > 0 ? [{
          type: "body",
          parameters: parameters.map(text => ({ type: "text", text }))
        }] : undefined
      }
    };

    console.log('Sending WhatsApp template message:', {
      to: formattedPhone,
      templateName,
      language,
      parameters,
      phoneNumberId: channel.phoneNumberId,
      isMarketing,
      usingMMLite: isMarketing
    });

    // Use MM Lite API endpoint for marketing messages
    const endpoint = isMarketing
      ? `${baseUrl}/${channel.phoneNumberId}/marketing_messages`
      : `${baseUrl}/${channel.phoneNumberId}/messages`;

    console.log('WhatsApp API endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channel.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API Error:', responseData);
      throw new Error(responseData.error?.message || 'Failed to send template message');
    }

    console.log('WhatsApp message sent successfully:', responseData);
    return responseData;
  }


  /**
   * Get a temporary media download URL for a WhatsApp mediaId
   */
  async fetchMediaUrl(mediaId: string): Promise<string> {
    const url = `${this.baseUrl}/${mediaId}`;
    console.log(`Fetching media URL: ${url}`);

    const response = await fetch(url, { headers: this.headers });
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ WhatsApp API Media Fetch Error:", data);
      throw new Error(data.error?.message || "Failed to fetch media URL");
    }

    if (!data.url) {
      throw new Error("No media URL returned by WhatsApp API");
    }

    console.log("✅ Media URL fetched successfully:", data.url);
    return data.url; // Temporary signed URL
  }

  /**
   * Download the media file (image, video, document, etc.)
   * and save it locally
   */

  // async downloadMedia(mediaId: string, savePath: string): Promise<void> {
  //   const mediaUrl = await this.fetchMediaUrl(mediaId);

  //   const response = await fetch(mediaUrl, { headers: this.headers });
  //   if (!response.ok) {
  //     throw new Error(`Failed to download media: ${response.statusText}`);
  //   }

  //   await streamPipeline(response.body as any, fs.createWriteStream(savePath));

  //   console.log(`✅ Media downloaded and saved to ${savePath}`);
  // }


  // Static method for checking rate limits
  static async checkRateLimit(channelId: string): Promise<boolean> {
    // Simple rate limit check - can be enhanced with Redis or database tracking
    return true;
  }

  // Format phone number to international format
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // If number doesn't start with country code, add it
    // Assuming India code 91 if not specified (based on the test number +919310797700)
    if (cleaned.length === 10) {
      // Indian number without country code
      cleaned = '91' + cleaned;
    }

    return cleaned;
  }

  // Deprecated - MM Lite now uses marketing_messages endpoint in sendTemplateMessage
  // Keeping for backward compatibility but routes to sendTemplateMessage
  private async sendMMliteMessage(to: string, templateName: string, parameters: string[] = [], language: string = "en_US"): Promise<any> {
    return WhatsAppApiService.sendTemplateMessage(
      this.channel,
      to,
      templateName,
      parameters,
      language,
      true // isMarketing = true for MM Lite
    );
  }

  async createTemplate(templateData: any): Promise<any> {
    const components = this.formatTemplateComponents(templateData);

    const body = {
      name: templateData.name,
      category: templateData.category,
      language: templateData.language,
      components
    };

    const response = await fetch(
      `${this.baseUrl}/${this.channel.whatsappBusinessAccountId}/message_templates`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create template');
    }

    return await response.json();
  }

  async deleteTemplate(templateName: string): Promise<any> {
    // WhatsApp API requires template name to delete
    const response = await fetch(
      `${this.baseUrl}/${this.channel.whatsappBusinessAccountId}/message_templates?name=${encodeURIComponent(templateName)}`,
      {
        method: 'DELETE',
        headers: this.headers
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete template');
    }

    return await response.json();
  }

  async getTemplates(): Promise<WhatsAppTemplate[]> {
    const response = await fetch(
      `${this.baseUrl}/${this.channel.whatsappBusinessAccountId}/message_templates?fields=id,status,name,language,category,components&limit=100`,
      {
        headers: this.headers
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch templates');
    }

    const data = await response.json();
    return data.data || [];
  }

  async sendMessage(to: string, templateName: string, parameters: string[] = []): Promise<any> {
    const formattedPhone = this.formatPhoneNumber(to);
    const body = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
        components: parameters.length > 0 ? [{
          type: "body",
          parameters: parameters.map(text => ({ type: "text", text }))
        }] : undefined
      }
    };

    console.log('Sending WhatsApp message:', {
      to: formattedPhone,
      templateName,
      parameters,
      phoneNumberId: this.channel.phoneNumberId
    });

    const response = await fetch(
      `${this.baseUrl}/${this.channel.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API Error:', responseData);
      throw new Error(responseData.error?.message || 'Failed to send message');
    }

    console.log('WhatsApp message sent successfully:', responseData);
    return responseData;
  }

  async sendTextMessage(to: string, text: string): Promise<any> {
    const formattedPhone = this.formatPhoneNumber(to);
    const body = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "text",
      text: { body: text }
    };

    const response = await fetch(
      `${this.baseUrl}/${this.channel.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to send message');
    }

    return await response.json();
  }

  async getPublicMediaUrl(relativePath: string): Promise<string> {
    // Assuming your uploads are served at /uploads endpoint
    // Adjust this based on your server configuration
    const baseUrl = process.env.APP_URL || 'https://whatsway.diploy.in';

    // Remove leading slash if present
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;

    return `${baseUrl}/${cleanPath}`;
  }

  /**
  * Upload media buffer to WhatsApp (for cloud files)
  */
  async uploadMediaBuffer(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<string> {
    try {
      const FormData = (await import("form-data")).default;
      const form = new FormData();

      form.append("file", buffer, {
        filename: filename,
        contentType: mimeType,
      });
      form.append("messaging_product", "whatsapp");

      const response = await axios.post(
        `${this.baseUrl}/${this.channel.phoneNumberId}/media`,
        form,
        {
          headers: {
            Authorization: `Bearer ${this.channel.accessToken}`,
            ...form.getHeaders(),
          },
        }
      );

      console.log("✅ WhatsApp media upload response:", response.data);
      return response.data.id;
    } catch (error) {
      console.error("❌ WhatsApp upload buffer error:", error);
      throw new Error("Failed to upload media buffer to WhatsApp");
    }
  }

  async uploadMedia(filePath: string, mimeType: string): Promise<string> {
    const resolvedPath = path.resolve(filePath);

    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("file", fs.createReadStream(resolvedPath), {
      filename: path.basename(resolvedPath),
      contentType: mimeType,
    });

    console.log("Uploading local media:", resolvedPath, mimeType);

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.channel.phoneNumberId}/media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.channel.accessToken}`,
            ...formData.getHeaders(),
          },
        }
      );

      console.log("Media uploaded successfully, ID:", response.data.id);
      return response.data.id;
    } catch (error: any) {
      console.error("WhatsApp upload error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error?.message || "Failed to upload media"
      );
    }
  }

  async uploadMediaManual(filePath: string, mimeType: string): Promise<string> {
    const resolvedPath = path.resolve(filePath);
    const fileBuffer = fs.readFileSync(resolvedPath);
    const fileName = path.basename(resolvedPath);

    // Create boundary for multipart form
    const boundary = `----formdata-node-${Math.random().toString(36)}`;

    // Construct multipart body manually
    const chunks: Buffer[] = [];

    // Add messaging_product field
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="messaging_product"\r\n\r\n`));
    chunks.push(Buffer.from(`whatsapp\r\n`));

    // Add file field
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
    chunks.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`));
    chunks.push(fileBuffer);
    chunks.push(Buffer.from(`\r\n`));

    // End boundary
    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(chunks);

    console.log("Uploading local media:", resolvedPath, mimeType);

    const response = await fetch(
      `${this.baseUrl}/${this.channel.phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.channel.accessToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp upload error response:", data);
      throw new Error(data.error?.message || "Failed to upload media");
    }

    console.log("Media uploaded successfully, ID:", data.id);
    return data.id;
  }


  // async getMediaUrl(mediaId: string): Promise<string> {
  //   console.log("Fetching media URL for ID:", mediaId);

  //   const response = await fetch(
  //     `${this.baseUrl}/${mediaId}`,
  //     {
  //       method: "GET",
  //       headers: {
  //         Authorization: `Bearer ${this.channel.accessToken}`,
  //       },
  //     }
  //   );

  //   const data = await response.json();

  //   if (!response.ok) {
  //     console.error("WhatsApp get media URL error:", data);
  //     throw new Error(data.error?.message || "Failed to get media URL");
  //   }

  //   // WhatsApp returns the media URL that can be used to download the file
  //   return data.url;
  // }

  async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const response = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, {
        headers: {
          'Authorization': `Bearer ${this.channel.accessToken}`
        }
      });

      if (!response.ok) {
        console.error('Failed to get media URL:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error getting media URL:', error);
      return null;
    }
  }

  /**
   * Download media content as buffer
   */
  async getMedia(mediaId: string): Promise<Buffer | null> {
    try {
      // First, get the fresh media URL
      const mediaUrl = await this.getMediaUrl(mediaId);
      if (!mediaUrl) {
        return null;
      }

      // Then, download the media content
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.channel.accessToken}`,
          'User-Agent': 'WhatsAppBusinessAPI/1.0'
        }
      });

      if (!response.ok) {
        console.error('Failed to download media:', response.status, response.statusText);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error downloading media:', error);
      return null;
    }
  }

  /**
   * Stream media content directly
   */
  async streamMedia(mediaId: string, res: Response<any>): Promise<boolean> {
    try {
      // First, get the fresh media URL
      const mediaUrl = await this.getMediaUrl(mediaId);
      if (!mediaUrl) {
        return false;
      }

      // Stream using axios
      const response = await axios({
        method: 'get',
        url: mediaUrl,
        responseType: 'stream',
        headers: {
          'Authorization': `Bearer ${this.channel.accessToken}`,
          'User-Agent': 'WhatsAppBusinessAPI/1.0'
        }
      });

      if (response.status !== 200) {
        console.error('Failed to stream media:', response.status, response.statusText);
        return false;
      }

      // Set content length if available
      if (response.headers['content-length']) {
        res.set('Content-Length', response.headers['content-length']);
      }

      // Pipe the stream
      response.data.pipe(res);

      return new Promise((resolve, reject) => {
        response.data.on('end', () => resolve(true));
        response.data.on('error', (error: any) => {
          console.error('Stream error:', error);
          reject(false);
        });
      });

    } catch (error) {
      console.error('Error streaming media with axios:', error);
      return false;
    }
  }


  // Optional: Method to download and save media locally
  async downloadAndSaveMedia(mediaUrl: string, fileName: string): Promise<string> {
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${this.channel.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to download media");
    }

    const buffer = await response.arrayBuffer();
    const localPath = path.join("uploads", "media", fileName);

    // Ensure directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(localPath, Buffer.from(buffer));
    return localPath;
  }


  async sendMediaMessage(to: string, mediaId: string, type: "image" | "video" | "audio" | "document", caption?: string): Promise<any> {
    const formattedPhone = this.formatPhoneNumber(to);

    const body: any = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: type,
      [type]: {
        id: mediaId
      }
    };

    if (caption && (type === "image" || type === "video" || type === "document")) {
      body[type].caption = caption;
    }

    const response = await fetch(
      `${this.baseUrl}/${this.channel.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to send media message");
    }

    return data;
  }


  async sendDirectMessage(payload: any): Promise<any> {
    // Format phone number if 'to' field exists
    if (payload.to) {
      payload.to = this.formatPhoneNumber(payload.to);
    }

    const body = {
      messaging_product: "whatsapp",
      ...payload
    };
    console.log('Sending direct WhatsApp message with payload:', body);
    const response = await fetch(
      `${this.baseUrl}/${this.channel.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to send message');
    }

    const data = await response.json();
    console.log('Direct WhatsApp message sent successfully:', data);
    return { success: true, data };
  }

  private formatTemplateComponents(templateData: any): any[] {
    const components = [];

    // Handle media header if present
    if (templateData.mediaType && templateData.mediaType !== 'text') {
      const headerFormat = templateData.mediaType.toUpperCase();
      if (templateData.header) {
        components.push({
          type: "HEADER",
          format: headerFormat,
          text: templateData.header,
          example: templateData.mediaUrl ? {
            header_handle: [templateData.mediaUrl]
          } : undefined
        });
      }
    } else if (templateData.header) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: templateData.header
      });
    }

    // Body component
    components.push({
      type: "BODY",
      text: templateData.body
    });

    // Footer component
    if (templateData.footer) {
      components.push({
        type: "FOOTER",
        text: templateData.footer
      });
    }

    // Buttons
    if (templateData.buttons && templateData.buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: templateData.buttons.map((button: any) => {
          if (button.type === 'url') {
            return {
              type: "URL",
              text: button.text,
              url: button.url
            };
          } else if (button.type === 'phone') {
            return {
              type: "PHONE_NUMBER",
              text: button.text,
              phone_number: button.phoneNumber
            };
          } else {
            return {
              type: "QUICK_REPLY",
              text: button.text
            };
          }
        })
      });
    }

    return components;
  }

  async revokeMessage(whatsappMessageId: string): Promise<any> {
    const phoneNumberId = this.channel.phoneNumberId;

    if (!phoneNumberId) {
      throw new Error("WhatsApp phone number ID not configured for this channel");
    }

    const response = await fetch(
      `${this.baseUrl}/${phoneNumberId}/messages`,
      {
        method: "DELETE",
        headers: this.headers,
        body: JSON.stringify({
          message_id: whatsappMessageId,
        }),
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error("❌ WhatsApp Revoke Full Error:", responseData);
      throw new Error(responseData.error?.message || "Failed to revoke message");
    }

    return responseData;
  }

  async getMessageStatus(whatsappMessageId: string): Promise<any> {
    // WhatsApp doesn't provide a direct API to get message status by ID
    // Status updates come through webhooks, so we'll return a mock response
    // In production, you would store webhook status updates and query from database
    return {
      status: 'sent',
      deliveredAt: null,
      readAt: null,
      errorCode: null,
      errorMessage: null
    };
  }
}