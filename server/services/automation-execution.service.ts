// automation-execution.service.ts - Enhanced with Conditions Support
import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  automations,
  automationNodes,
  automationExecutions,
  automationExecutionLogs,
  automationEdges,
  contacts,
  templates,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { sendBusinessMessage } from "../services/messageService";
import { WhatsAppApiService } from "./whatsapp-api";
import { storage } from "server/storage";

interface ExecutionContext {
  executionId: string;
  automationId: string;
  contactId?: string;
  conversationId?: string;
  variables: Record<string, any>;
  triggerData: any;
  lastUserMessage?: string; // Add this to track user input for conditions
}

interface PendingExecution {
  executionId: string;
  automationId: string;
  nodeId: string;
  conversationId: string;
  contactId?: string;
  context: ExecutionContext;
  saveAs?: string;
  timestamp: Date;
  status: 'waiting_for_response';
  expectedButtons?: any[];
}

export class AutomationExecutionService {
  private pendingExecutions = new Map<string, PendingExecution>();

  /**
   * Start automation execution (called from your controller)
   */
  async executeAutomation(executionId: string) {
    console.log(`Starting execution: ${executionId}`);

    try {
      // Get execution record
      const execution = await db.query.automationExecutions.findFirst({
        where: eq(automationExecutions.id, executionId),
      });

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      // Get automation with nodes and edges
      const automation = await this.getAutomationWithFlow(execution.automationId);
      if (!automation) {
        throw new Error(`Automation ${execution.automationId} not found`);
      }

      // Update execution count
      await db.update(automations)
        .set({
          executionCount: automation.executionCount !== null ? automation.executionCount + 1 : null,
          lastExecutedAt: new Date()
        })
        .where(eq(automations.id, execution.automationId));

      // Create execution context
      const triggerData = execution.triggerData ?? {};

      const context: ExecutionContext = {
        executionId: execution.id,
        automationId: execution.automationId,
        contactId: execution.contactId ?? undefined,
        conversationId: execution.conversationId ?? undefined,
        variables: {
          contactId: execution.contactId ?? undefined,
          conversationId: execution.conversationId ?? undefined,
          ...triggerData
        },
        triggerData,
        lastUserMessage:
          (execution.triggerData as { message?: { content?: string; text?: string } }).message
            ?.content ||
          (execution.triggerData as { message?: { content?: string; text?: string } }).message
            ?.text ||
          "",
      };

      // Get first node = no incoming edges
      const firstNode = automation.nodes.find(
        (n: any) => !automation.edges.some((e: any) => e.targetNodeId === n.nodeId)
      );

      if (firstNode) {
        await this.executeNode(firstNode, automation, context);
      } else {
        await this.completeExecution(executionId, 'completed', 'No start node found');
      }

    } catch (error) {
      console.error(`Error executing automation ${executionId}:`, error);
      await this.completeExecution(executionId, 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: any, automation: any, context: ExecutionContext) {
    const startTime = new Date();
    console.log(`Executing node ${node.nodeId} (${node.type})`);

    try {
      // Log node start
      await this.logNodeExecution(
        context.executionId,
        node.nodeId,
        node.type,
        'running',
        node.data,
        null,
        null
      );

      let result: any = null;

      // Execute based on node type
      switch (node.type) {
        case 'custom_reply':
          result = await this.executeCustomReply(node, context);
          break;

        case 'user_reply':
          result = await this.executeUserReply(node, context);
          break;

        case 'time_gap':
          result = await this.executeTimeGap(node, context);
          return; // Time gap handles its own continuation

        case 'send_template':
          result = await this.executeSendTemplate(node, context);
          break;

        case 'assign_user':
          result = await this.executeAssignUser(node, context);
          break;

        case 'conditions':
          result = await this.executeConditions(node, automation, context);
          return; // Conditions handle their own routing

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      // Log success
      await this.logNodeExecution(
        context.executionId,
        node.nodeId,
        node.type,
        'completed',
        node.data,
        result,
        null
      );

      // Continue to next node
      await this.continueToNextNode(node, automation, context);

    } catch (error) {
      console.error(`Error executing node ${node.nodeId}:`, error);

      // Log error
      await this.logNodeExecution(
        context.executionId,
        node.nodeId,
        node.type,
        'failed',
        node.data,
        null,
        (error as Error).message
      );

      // Fail the entire execution
      await this.completeExecution(context.executionId, 'failed', `Node ${node.nodeId} failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Execute conditions node - NEW
   */
  private async executeConditions(node: any, automation: any, context: ExecutionContext) {
    const conditionData = node.data;
    const conditionType = conditionData.conditionType || 'keyword';
    const matchType = conditionData.matchType || 'any';
    const keywords = conditionData.keywords || [];

    console.log(`🔍 Evaluating condition: ${conditionType}, match: ${matchType}, keywords: ${keywords.join(', ')}`);

    let conditionMet = false;
    let matchedKeyword = null;
    let userInput = context.lastUserMessage || '';

    // Convert to lowercase for case-insensitive matching
    const lowerInput = userInput.toLowerCase().trim();
    const lowerKeywords = keywords.map((k: string) => k.toLowerCase().trim());

    switch (conditionType) {
      case 'keyword':
        if (matchType === 'any') {
          // Check if any keyword matches
          for (const keyword of lowerKeywords) {
            if (lowerInput.includes(keyword)) {
              conditionMet = true;
              matchedKeyword = keyword;
              break;
            }
          }
        } else if (matchType === 'all') {
          // Check if all keywords match
          conditionMet = lowerKeywords.every((keyword: string) => lowerInput.includes(keyword));
          matchedKeyword = conditionMet ? lowerKeywords.join(', ') : null;
        } else if (matchType === 'exact') {
          // Check for exact match
          conditionMet = lowerKeywords.includes(lowerInput);
          matchedKeyword = conditionMet ? lowerInput : null;
        }
        break;

      case 'regex':
        try {
          const pattern = new RegExp(keywords[0] || '', 'i'); // case insensitive
          conditionMet = pattern.test(userInput);
          matchedKeyword = conditionMet ? keywords[0] : null;
        } catch (error) {
          console.error('Invalid regex pattern:', keywords[0], error);
          conditionMet = false;
        }
        break;

      case 'variable':
        // Check variable conditions (e.g., {{contactName}} === 'John')
        const variableCondition = keywords[0] || '';
        conditionMet = this.evaluateVariableCondition(variableCondition, context.variables);
        matchedKeyword = conditionMet ? variableCondition : null;
        break;

      default:
        console.warn(`Unknown condition type: ${conditionType}`);
        conditionMet = false;
    }

    // Update context with condition result
    context.variables.lastConditionResult = conditionMet;
    context.variables.matchedKeyword = matchedKeyword;

    const result = {
      conditionMet,
      matchedKeyword,
      userInput,
      conditionType,
      matchType,
      keywords
    };

    // Log condition evaluation
    await this.logNodeExecution(
      context.executionId,
      node.nodeId,
      node.type,
      'completed',
      conditionData,
      result,
      null
    );

    console.log(`🎯 Condition ${conditionMet ? 'MET' : 'NOT MET'}: "${matchedKeyword || 'none'}"`);

    // Route based on condition result
    await this.routeFromCondition(node, automation, context, conditionMet);

    return result;
  }

  /**
   * Route execution based on condition result
   */
  private async routeFromCondition(
    conditionNode: any,
    automation: any,
    context: ExecutionContext,
    conditionMet: boolean
  ) {
    // Get outgoing edges from condition node
    const outgoingEdges = automation.edges.filter(
      (e: any) => e.sourceNodeId === conditionNode.nodeId
    );

    if (outgoingEdges.length === 0) {
      console.log(`⚠️  No outgoing edges from condition node ${conditionNode.nodeId}`);
      await this.completeExecution(context.executionId, 'completed', 'Condition evaluated but no next steps defined');
      return;
    }

    // If condition is met, follow the first edge (TRUE path)
    // If condition is not met, look for alternative edges or complete execution
    if (conditionMet) {
      // Follow TRUE path (first edge)
      const trueEdge = outgoingEdges[0];
      const nextNode = automation.nodes.find((n: any) => n.nodeId === trueEdge.targetNodeId);

      if (nextNode) {
        console.log(`➡️  Condition TRUE: Following path to ${nextNode.type} node`);
        await this.executeNode(nextNode, automation, context);
      } else {
        console.warn(`Node ${trueEdge.targetNodeId} not found for TRUE path`);
        await this.completeExecution(context.executionId, 'completed', 'TRUE path node not found');
      }
    } else {
      // Check if there's a FALSE path (second edge) or alternative routing
      if (outgoingEdges.length > 1) {
        const falseEdge = outgoingEdges[1];
        const nextNode = automation.nodes.find((n: any) => n.nodeId === falseEdge.targetNodeId);

        if (nextNode) {
          console.log(`➡️  Condition FALSE: Following alternative path to ${nextNode.type} node`);
          await this.executeNode(nextNode, automation, context);
        } else {
          console.warn(`Node ${falseEdge.targetNodeId} not found for FALSE path`);
          await this.completeExecution(context.executionId, 'completed', 'FALSE path node not found');
        }
      } else {
        // No FALSE path defined, complete execution
        console.log(`🛑 Condition FALSE: No alternative path defined, ending execution`);
        await this.completeExecution(context.executionId, 'completed', 'Condition not met and no alternative path');
      }
    }
  }

  /**
   * Evaluate variable-based conditions
   */
  private evaluateVariableCondition(condition: string, variables: Record<string, any>): boolean {
    try {
      // Replace variables in condition string
      const resolvedCondition = this.replaceVariables(condition, variables);

      // Simple evaluation for common patterns
      // Example: "{{contactName}} === 'John'" becomes "John === 'John'"
      // This is a basic implementation - you might want to use a proper expression evaluator

      if (resolvedCondition.includes('===')) {
        const [left, right] = resolvedCondition.split('===').map(s => s.trim().replace(/['"]/g, ''));
        return left === right;
      }

      if (resolvedCondition.includes('!==')) {
        const [left, right] = resolvedCondition.split('!==').map(s => s.trim().replace(/['"]/g, ''));
        return left !== right;
      }

      if (resolvedCondition.includes('contains')) {
        const [left, right] = resolvedCondition.split('contains').map(s => s.trim().replace(/['"]/g, ''));
        return left.toLowerCase().includes(right.toLowerCase());
      }

      // Default: check if resolved condition is truthy
      return Boolean(resolvedCondition);

    } catch (error) {
      console.error('Error evaluating variable condition:', error);
      return false;
    }
  }

  /**
   * Continue to next node(s) using edges
   */
  private async continueToNextNode(currentNode: any, automation: any, context: ExecutionContext) {
    // Get outgoing edges
    const outgoingEdges = automation.edges.filter(
      (e: any) => e.sourceNodeId === currentNode.nodeId
    );

    if (outgoingEdges.length === 0) {
      // No more nodes → execution complete
      await this.completeExecution(context.executionId, 'completed', 'All nodes executed successfully');
      return;
    }

    // Follow each edge
    for (const edge of outgoingEdges) {
      const nextNode = automation.nodes.find((n: any) => n.nodeId === edge.targetNodeId);
      if (nextNode) {
        await this.executeNode(nextNode, automation, context);
      }
    }
  }

  /**
   * Execute custom reply node
   */
  // private async executeCustomReply(node: any, context: ExecutionContext) {
  //   const message = this.replaceVariables(node.data.message || '', context.variables);
  //   console.log(`Sending message to conversation ${context.conversationId}: "${message}"`);

  //   const getContact = await db.query.contacts.findFirst({
  //     where: eq(contacts?.id, context.contactId),
  //   });

  //   if (getContact?.phone) {
  //     await sendBusinessMessage({
  //       to: getContact?.phone,
  //       message,
  //       channelId: getContact?.channelId,
  //     });
  //   }

  //   console.log(`✅ Message sent: ${message}`);

  //   return {
  //     action: 'message_sent',
  //     message,
  //     conversationId: context.conversationId
  //   };
  // }

  /**
   * Enhanced handleUserResponse to update context with user message for conditions
   */
  async handleUserResponse(conversationId: string, userResponse: string, interactiveData?: any) {
    console.log(`📨 Received user response for conversation ${conversationId}: "${userResponse}"`);

    // Find pending execution for this conversation
    const pendingExecution = this.findPendingExecutionByConversation(conversationId);
    if (!pendingExecution) {
      console.warn(`No pending execution found for conversation ${conversationId}`);
      return null;
    }

    try {
      // Remove from pending
      this.pendingExecutions.delete(pendingExecution.pendingId);

      // Process the response
      let processedResponse = userResponse;
      let selectedButtonId = null;

      // If this was a button click response
      if (interactiveData && interactiveData.type === 'button_reply') {
        selectedButtonId = interactiveData.button_reply.id;
        processedResponse = interactiveData.button_reply.title;
        console.log(`🔘 Button clicked: ${selectedButtonId} - "${processedResponse}"`);
      } else if (pendingExecution.expectedButtons && pendingExecution.expectedButtons.length > 0) {
        // Try to match text response to button options
        const matchedButton = this.matchTextToButton(userResponse, pendingExecution.expectedButtons);
        if (matchedButton) {
          selectedButtonId = matchedButton.id;
          processedResponse = matchedButton.text;
          console.log(`🎯 Matched text "${userResponse}" to button: ${selectedButtonId} - "${processedResponse}"`);
        }
      }

      // Update context with user response
      const context = pendingExecution.context;
      context.lastUserMessage = processedResponse; // ✅ Update for conditions

      if (pendingExecution.saveAs) {
        context.variables[pendingExecution.saveAs] = processedResponse;

        // Also save button ID if available
        if (selectedButtonId) {
          context.variables[`${pendingExecution.saveAs}_button_id`] = selectedButtonId;
        }

        console.log(`💾 Saved user response to variable: ${pendingExecution.saveAs} = "${processedResponse}"`);
      }

      // Log the response received
      await this.logNodeExecution(
        context.executionId,
        pendingExecution.nodeId,
        'user_reply',
        'completed',
        { question: 'User response received', interactiveData },
        {
          userResponse: processedResponse,
          selectedButtonId,
          savedAs: pendingExecution.saveAs
        },
        null
      );

      // Resume execution status
      await db.update(automationExecutions)
        .set({
          status: 'running',
          result: null
        })
        .where(eq(automationExecutions.id, context.executionId));

      console.log(`▶️  Resuming execution ${context.executionId} with user response`);

      // Get fresh automation data and continue
      const automation = await this.getAutomationWithFlow(context.automationId);
      if (!automation) {
        throw new Error(`Automation ${context.automationId} not found during resume`);
      }

      const currentNode = automation.nodes.find((n: any) => n.nodeId === pendingExecution.nodeId);
      if (currentNode) {
        await this.continueToNextNode(currentNode, automation, context);
      } else {
        throw new Error(`Node ${pendingExecution.nodeId} not found during resume`);
      }

      return {
        success: true,
        executionId: context.executionId,
        userResponse: processedResponse,
        selectedButtonId,
        savedVariable: pendingExecution.saveAs,
        resumedAt: new Date()
      };

    } catch (error) {
      console.error(`Error resuming execution for conversation ${conversationId}:`, error);

      await this.completeExecution(
        pendingExecution.executionId,
        'failed',
        `Failed to resume after user response: ${(error as Error).message}`
      );

      throw error;
    }
  }

  // // ... [Rest of your existing methods remain the same] ...

  // private async executeUserReply(node: any, context: ExecutionContext) {
  //   const question = this.replaceVariables(node.data.question || '', context.variables);
  //   const buttons = node.data.buttons || [];

  //   console.log(`Asking question to conversation ${context.conversationId}: "${question}"`);
  //   console.log('Question buttons:', buttons);

  //   // Get contact information
  //   const getContact = await db.query.contacts.findFirst({
  //     where: eq(contacts?.id, context.contactId),
  //   });

  //   if (!getContact?.phone) {
  //     throw new Error('Contact phone number not found');
  //   }

  //   // Send the question with buttons (if any)
  //   if (buttons.length > 0) {
  //     // Send interactive message with buttons
  //     await this.sendInteractiveMessage(
  //       getContact.phone,
  //       question,
  //       buttons,
  //       getContact.channelId,
  //       context.conversationId
  //     );
  //   } else {
  //     // Send regular text message
  //     await sendBusinessMessage({
  //       to: getContact.phone,
  //       message: question,
  //       channelId: getContact.channelId,
  //       conversationId: context.conversationId,
  //     });
  //   }

  //   // Create a unique pending execution ID
  //   const pendingId = `${context.executionId}_${node.nodeId}_${Date.now()}`;

  //   // Store the execution state for resumption
  //   const pendingExecution: PendingExecution = {
  //     executionId: context.executionId,
  //     automationId: context.automationId,
  //     nodeId: node.nodeId,
  //     conversationId: context.conversationId,
  //     contactId: context.contactId,
  //     context: { ...context },
  //     saveAs: node.data.saveAs,
  //     timestamp: new Date(),
  //     status: 'waiting_for_response',
  //     expectedButtons: buttons // Store buttons for validation
  //   };

  //   this.pendingExecutions.set(pendingId, pendingExecution);

  //   // Update execution status to paused
  //   await db.update(automationExecutions)
  //     .set({
  //       status: 'paused',
  //       result: `Waiting for user response to: "${question}"`
  //     })
  //     .where(eq(automationExecutions.id, context.executionId));

  //   // Log that we're waiting
  //   await this.logNodeExecution(
  //     context.executionId,
  //     node.nodeId,
  //     node.type,
  //     'waiting_for_response',
  //     { ...node.data, question, buttons },
  //     { pendingId, action: 'interactive_question_sent' },
  //     null
  //   );

  //   console.log(`✅ Interactive question sent: ${question} with ${buttons.length} buttons`);
  //   console.log(`⏸️  Execution paused. Waiting for user response (pending ID: ${pendingId})`);

  //   return {
  //     action: 'execution_paused',
  //     question,
  //     buttons,
  //     conversationId: context.conversationId,
  //     pendingId,
  //     saveAs: node.data.saveAs
  //   };
  // }



  // Enhanced executeCustomReply method with media support
  private async executeCustomReply(node: any, context: ExecutionContext) {
    const message = this.replaceVariables(node.data.message || '', context.variables);
    const nodeData = node.data;

    console.log(`Sending message to conversation ${context.conversationId}: "${message}"`);

    const getContact = await db.query.contacts.findFirst({
      where: eq(contacts?.id!, context.contactId!),
    });

    if (!getContact?.phone) {
      throw new Error('Contact phone number not found');
    }

    // Check for media attachments
    const hasMedia = nodeData.imageFile || nodeData.videoFile || nodeData.audioFile || nodeData.documentFile;

    if (hasMedia) {
      await this.sendMediaMessage(getContact, nodeData, message, context);
    } else {
      // Regular text message
      if (!getContact?.phone) {
        throw new Error('Contact phone number not found');
      }

      if (!getContact?.channelId) {
        throw new Error('channelId not found');
      }

      await sendBusinessMessage({
        to: getContact.phone,
        message,
        channelId: getContact.channelId,
      });
    }

    console.log(`✅ Message sent: ${message}`);

    return {
      action: 'message_sent',
      message,
      conversationId: context.conversationId,
      hasMedia
    };
  }

  /**
   * Send media message with WhatsApp API
   */
  private async sendMediaMessage(contact: any, nodeData: any, caption: string, context: ExecutionContext) {
    try {
      // Get channel information
      const channel = await storage.getChannel(contact.channelId);
      if (!channel) {
        throw new Error(`Channel ${contact.channelId} not found`);
      }

      const whatsappApi = new WhatsAppApiService(channel);
      const formattedPhone = this.formatPhoneNumber(contact.phone);

      let mediaPayload: any = {
        messaging_product: "whatsapp",
        to: formattedPhone,
      };

      console.log("nodeData for media:", nodeData);

      // Determine media type and construct payload
      if (nodeData.imageFile) {
        mediaPayload.type = "image";
        mediaPayload.image = {
          link: await this.getPublicMediaUrl(nodeData.imageFile.path),
          caption: caption || undefined
        };
      } else if (nodeData.videoFile) {
        mediaPayload.type = "video";
        mediaPayload.video = {
          link: await this.getPublicMediaUrl(nodeData.videoFile.path),
          caption: caption || undefined
        };
      } else if (nodeData.audioFile) {
        mediaPayload.type = "audio";
        mediaPayload.audio = {
          link: await this.getPublicMediaUrl(nodeData.audioFile.path)
        };
        // Note: Audio doesn't support captions in WhatsApp API
        if (caption) {
          // Send caption as separate text message after audio
          await this.sendTextMessage(whatsappApi, formattedPhone, caption);
        }
      } else if (nodeData.documentFile) {
        mediaPayload.type = "document";
        mediaPayload.document = {
          link: await this.getPublicMediaUrl(nodeData.documentFile.path),
          filename: nodeData.documentFile.filename,
          caption: caption || undefined
        };
      }
      console.log("Media payload:", mediaPayload);
      // Send media message
      const response = await fetch(
        `https://graph.facebook.com/v23.0/${channel.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${channel.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mediaPayload)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('WhatsApp Media API Error:', error);
        throw new Error(error.error?.message || 'Failed to send media message');
      }

      const result = await response.json();

      // Save message to database
      await this.saveMediaMessage(contact, nodeData, caption, context, result);

      console.log(`✅ Media message sent successfully to ${contact.phone}`);
      return result;

    } catch (error) {
      console.error('Error sending media message:', error);

      // Fallback: send as text message with media info
      const fallbackMessage = `${caption}\n\n[Media file: ${this.getMediaFileName(nodeData)}]`;
      await sendBusinessMessage({
        to: contact.phone,
        message: fallbackMessage,
        channelId: contact.channelId,
      });

      throw error;
    }
  }

  /**
   * Enhanced executeUserReply with media support
   */
  private async executeUserReply(node: any, context: ExecutionContext) {
    const question = this.replaceVariables(node.data.question || '', context.variables);
    const buttons = node.data.buttons || [];
    const nodeData = node.data;

    console.log(`Asking question to conversation ${context.conversationId}: "${question}"`);
    console.log('Question buttons:', buttons);

    // Get contact information
    const getContact = await db.query.contacts.findFirst({
      where: eq(contacts?.id!, context.contactId!),
    });

    if (!getContact?.phone) {
      throw new Error('Contact phone number not found');
    }

    // Check for media attachments in the question
    const hasMedia = nodeData.imageFile || nodeData.videoFile || nodeData.audioFile || nodeData.documentFile;

    if (hasMedia) {
      // Send media with question first
      await this.sendMediaMessage(getContact, nodeData, question, context);
    }

    if (!getContact?.channelId) {
      throw new Error('channelId not found');
    }

    // Send the question with buttons (if any)
    if (buttons.length > 0) {
      // Send interactive message with buttons
      await this.sendInteractiveMessage(
        getContact.phone,
        hasMedia ? "Please choose an option:" : question, // Avoid duplicate text if media was sent
        buttons,
        getContact.channelId,
        context.conversationId
      );
    } else if (!hasMedia) {
      // Send regular text message only if no media was sent
      await sendBusinessMessage({
        to: getContact.phone,
        message: question,
        channelId: getContact.channelId,
        conversationId: context.conversationId,
      });
    }

    // Create a unique pending execution ID
    const pendingId = `${context.executionId}_${node.nodeId}_${Date.now()}`;

    if (!context.conversationId) {
      throw new Error('conversationId is required to wait for user response');
    }
    // Store the execution state for resumption
    const pendingExecution: PendingExecution = {
      executionId: context.executionId,
      automationId: context.automationId,
      nodeId: node.nodeId,
      conversationId: context.conversationId,
      contactId: context.contactId,
      context: { ...context },
      saveAs: node.data.saveAs,
      timestamp: new Date(),
      status: 'waiting_for_response',
      expectedButtons: buttons
    };

    this.pendingExecutions.set(pendingId, pendingExecution);

    // Update execution status to paused
    await db.update(automationExecutions)
      .set({
        status: 'paused',
        result: `Waiting for user response to: "${question}"`
      })
      .where(eq(automationExecutions.id, context.executionId));

    // Log that we're waiting
    await this.logNodeExecution(
      context.executionId,
      node.nodeId,
      node.type,
      'waiting_for_response',
      { ...node.data, question, buttons, hasMedia },
      { pendingId, action: 'interactive_question_sent' },
      null
    );

    console.log(`✅ Interactive question sent: ${question} with ${buttons.length} buttons and media: ${hasMedia}`);
    console.log(`⏸️  Execution paused. Waiting for user response (pending ID: ${pendingId})`);

    return {
      action: 'execution_paused',
      question,
      buttons,
      hasMedia,
      conversationId: context.conversationId,
      pendingId,
      saveAs: node.data.saveAs
    };
  }

  /**
   * Helper method to send text message
   */
  private async sendTextMessage(whatsappApi: any, to: string, message: string) {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message }
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${whatsappApi.channel.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappApi.channel.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to send text message');
    }

    return await response.json();
  }

  /**
   * Convert relative media path to public URL
   */
  private async getPublicMediaUrl(relativePath: string): Promise<string> {
    // Assuming your uploads are served at /uploads endpoint
    // Adjust this based on your server configuration
    const baseUrl = process.env.APP_URL || 'https://whatsway.diploy.in';

    // Remove leading slash if present
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;

    return `${baseUrl}/${cleanPath}`;
  }

  /**
   * Save media message to database
   */
  private async saveMediaMessage(
    contact: any,
    nodeData: any,
    caption: string,
    context: ExecutionContext,
    whatsappResult: any
  ) {
    try {
      // Determine message type and content
      let messageType = 'text';
      let messageContent = caption;
      let metadata: any = {};

      if (nodeData.imageFile) {
        messageType = 'image';
        metadata = {
          mediaType: 'image',
          mediaPath: nodeData.imageFile.path,
          fileName: nodeData.imageFile.filename,
          fileSize: nodeData.imageFile.size,
          mimeType: nodeData.imageFile.mimetype
        };
      } else if (nodeData.videoFile) {
        messageType = 'video';
        metadata = {
          mediaType: 'video',
          mediaPath: nodeData.videoFile.path,
          fileName: nodeData.videoFile.filename,
          fileSize: nodeData.videoFile.size,
          mimeType: nodeData.videoFile.mimetype
        };
      } else if (nodeData.audioFile) {
        messageType = 'audio';
        metadata = {
          mediaType: 'audio',
          mediaPath: nodeData.audioFile.path,
          fileName: nodeData.audioFile.filename,
          fileSize: nodeData.audioFile.size,
          mimeType: nodeData.audioFile.mimetype
        };
      } else if (nodeData.documentFile) {
        messageType = 'document';
        metadata = {
          mediaType: 'document',
          mediaPath: nodeData.documentFile.path,
          fileName: nodeData.documentFile.filename,
          fileSize: nodeData.documentFile.size,
          mimeType: nodeData.documentFile.mimetype
        };
      }

      // Find conversation
      if (!context.conversationId) {
        console.warn('No conversationId in context, cannot save media message');
        return;
      }
      const conversation = await storage.getConversation(context.conversationId);
      if (!conversation) {
        console.warn('Conversation not found for media message');
        return;
      }

      console.log('Saving media message ', metadata, metadata.mediaPath, nodeData.documentFile.path, this.getPublicMediaUrl(metadata.mediaPath || ''), {
        conversationId: conversation.id,
        content: messageContent,
        status: "sent",
        whatsappMessageId: whatsappResult.messages?.[0]?.id,
        messageType,
        metadata: JSON.stringify(metadata),
        mediaUrl: await this.getPublicMediaUrl(metadata.mediaPath || ''),
      });

      // Create message record
      const createdMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: messageContent,
        status: "sent",
        whatsappMessageId: whatsappResult.messages?.[0]?.id,
        messageType,
        metadata: JSON.stringify(metadata),
        mediaUrl: await this.getPublicMediaUrl(metadata.mediaPath || ''),
      });

      // Update conversation
      await storage.updateConversation(conversation.id, {
        lastMessageAt: new Date(),
        lastMessageText: messageContent || `[${messageType}]`,
      });

      // Broadcast to websocket
      if ((global as any).broadcastToConversation) {
        (global as any).broadcastToConversation(conversation.id, {
          type: "new-message",
          message: createdMessage,
        });
      }

    } catch (error) {
      console.error('Error saving media message to database:', error);
    }
  }

  /**
   * Get media file name for fallback messages
   */
  private getMediaFileName(nodeData: any): string {
    if (nodeData.imageFile) return nodeData.imageFile.filename;
    if (nodeData.videoFile) return nodeData.videoFile.filename;
    if (nodeData.audioFile) return nodeData.audioFile.filename;
    if (nodeData.documentFile) return nodeData.documentFile.filename;
    return 'media file';
  }

  /**
   * Enhanced sendInteractiveMessage to handle media better
   */
  private async sendInteractiveMessage(
    to: string,
    question: string,
    buttons: any[],
    channelId: string,
    conversationId?: string
  ) {
    try {
      // Get channel information
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      // Create WhatsApp interactive message payload
      const interactivePayload = {
        messaging_product: "whatsapp",
        to: this.formatPhoneNumber(to),
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: question
          },
          action: {
            buttons: buttons.slice(0, 3).map((btn, index) => ({
              type: "reply",
              reply: {
                id: btn.id || `btn_${index}`,
                title: btn.text?.substring(0, 20) || `Option ${index + 1}`
              }
            }))
          }
        }
      };

      // Send via WhatsApp API
      const whatsappApi = new WhatsAppApiService(channel);
      const result = await this.sendInteractiveMessageDirect(whatsappApi, interactivePayload);

      // Save the message to database
      const messageContent = `${question}\n\nOptions:\n${buttons.map((btn, i) => `${i + 1}. ${btn.text}`).join('\n')}`;

      // Find conversation
      const conversation = conversationId
        ? await storage.getConversation(conversationId)
        : await storage.getConversationByPhone(to);

      if (conversation) {
        // Save message
        const createdMessage = await storage.createMessage({
          conversationId: conversation.id,
          content: messageContent,
          status: "sent",
          whatsappMessageId: result.messages?.[0]?.id,
          messageType: "interactive",
          metadata: JSON.stringify({ buttons, interactiveType: "button" })
        });

        // Update conversation
        await storage.updateConversation(conversation.id, {
          lastMessageAt: new Date(),
          lastMessageText: question,
        });

        // Broadcast to websocket
        if ((global as any).broadcastToConversation) {
          (global as any).broadcastToConversation(conversation.id, {
            type: "new-message",
            message: createdMessage,
          });
        }
      }

      console.log(`✅ Interactive message sent successfully to ${to}`);
      return result;

    } catch (error) {
      console.error('Error sending interactive message:', error);

      // Fallback to regular text message with numbered options
      console.log('📱 Falling back to text message with options...');
      const fallbackMessage = `${question}\n\nReply with:\n${buttons.map((btn, i) => `${i + 1}. ${btn.text}`).join('\n')}`;

      return await sendBusinessMessage({
        to,
        message: fallbackMessage,
        channelId,
        conversationId
      });
    }
  }

  // private async sendInteractiveMessage(
  //   to: string, 
  //   question: string, 
  //   buttons: any[], 
  //   channelId: string, 
  //   conversationId?: string
  // ) {
  //   try {
  //     // Get channel information
  //     const channel = await storage.getChannel(channelId);
  //     if (!channel) {
  //       throw new Error(`Channel ${channelId} not found`);
  //     }

  //     // Create WhatsApp interactive message payload
  //     const interactivePayload = {
  //       messaging_product: "whatsapp",
  //       to: this.formatPhoneNumber(to),
  //       type: "interactive",
  //       interactive: {
  //         type: "button",
  //         body: {
  //           text: question
  //         },
  //         action: {
  //           buttons: buttons.slice(0, 3).map((btn, index) => ({ // WhatsApp allows max 3 buttons
  //             type: "reply",
  //             reply: {
  //               id: btn.id || `btn_${index}`,
  //               title: btn.text?.substring(0, 20) || `Option ${index + 1}` // Max 20 chars
  //             }
  //           }))
  //         }
  //       }
  //     };

  //     // Send via WhatsApp API
  //     const whatsappApi = new WhatsAppApiService(channel);
  //     const result = await this.sendInteractiveMessageDirect(whatsappApi, interactivePayload);

  //     // Save the message to database
  //     const messageContent = `${question}\n\nOptions:\n${buttons.map((btn, i) => `${i + 1}. ${btn.text}`).join('\n')}`;

  //     // Find or create conversation
  //     let conversation = conversationId
  //       ? await storage.getConversation(conversationId)
  //       : await storage.getConversationByPhone(to);

  //     if (!conversation) {
  //       let contact = await storage.getContactByPhone(to);
  //       if (!contact) {
  //         contact = await storage.createContact({
  //           name: to,
  //           phone: to,
  //           channelId,
  //         });
  //       }

  //       conversation = await storage.createConversation({
  //         contactId: contact.id,
  //         contactPhone: to,
  //         contactName: contact.name || to,
  //         channelId,
  //         unreadCount: 0,
  //       });
  //     }

  //     // Save message
  //     const createdMessage = await storage.createMessage({
  //       conversationId: conversation.id,
  //       content: messageContent,
  //       sender: "business",
  //       status: "sent",
  //       whatsappMessageId: result.messages?.[0]?.id,
  //       messageType: "interactive",
  //       metadata: JSON.stringify({ buttons, interactiveType: "button" })
  //     });

  //     // Update conversation
  //     await storage.updateConversation(conversation.id, {
  //       lastMessageAt: new Date(),
  //       lastMessageText: question,
  //     });

  //     // Broadcast to websocket
  //     if ((global as any).broadcastToConversation) {
  //       (global as any).broadcastToConversation(conversation.id, {
  //         type: "new-message",
  //         message: createdMessage,
  //       });
  //     }

  //     console.log(`✅ Interactive message sent successfully to ${to}`);
  //     return result;

  //   } catch (error) {
  //     console.error('Error sending interactive message:', error);

  //     // Fallback to regular text message with numbered options
  //     console.log('📱 Falling back to text message with options...');
  //     const fallbackMessage = `${question}\n\nReply with:\n${buttons.map((btn, i) => `${i + 1}. ${btn.text}`).join('\n')}`;

  //     return await sendBusinessMessage({
  //       to,
  //       message: fallbackMessage,
  //       channelId,
  //       conversationId
  //     });
  //   }
  // }

  private async sendInteractiveMessageDirect(whatsappApi: any, payload: any) {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${whatsappApi.channel.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappApi.channel.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp API Error:', error);
      throw new Error(error.error?.message || 'Failed to send interactive message');
    }

    return await response.json();
  }

  private matchTextToButton(text: string, buttons: any[]) {
    const lowerText = text.toLowerCase().trim();

    // Direct text match
    let match = buttons.find(btn => btn.text.toLowerCase() === lowerText);
    if (match) return match;

    // Check if it's a number (1, 2, 3...)
    const numberMatch = lowerText.match(/^(\d+)$/);
    if (numberMatch) {
      const index = parseInt(numberMatch[1]) - 1;
      if (index >= 0 && index < buttons.length) {
        return buttons[index];
      }
    }

    // Partial text match
    match = buttons.find(btn =>
      btn.text.toLowerCase().includes(lowerText) ||
      lowerText.includes(btn.text.toLowerCase())
    );

    return match;
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');

    // Add country code if missing (assuming +1 for US/CA, adjust as needed)
    if (cleaned.length === 10) {
      return `1${cleaned}`;
    }

    return cleaned;
  }

  private findPendingExecutionByConversation(conversationId: string) {
    for (const [pendingId, execution] of this.pendingExecutions.entries()) {
      if (execution.conversationId === conversationId) {
        return { pendingId, ...execution };
      }
    }

    return null;
  }

  private async executeTimeGap(node: any, context: ExecutionContext, automation?: any) {
    const delay = node.data?.delay || 60;
    console.log(`⏳ Delaying execution by ${delay} seconds`);

    // Schedule continuation after delay
    setTimeout(async () => {
      try {
        console.log(`⏰ Delay completed, continuing execution`);

        // Get fresh automation data
        const freshAutomation = await this.getAutomationWithFlow(context.automationId);
        await this.continueToNextNode(node, freshAutomation, context);
      } catch (error) {
        console.error('Error continuing after delay:', error);
        await this.completeExecution(context.executionId, 'failed', `Delay continuation failed: ${(error as Error).message}`);
      }
    }, delay * 1000);

    return {
      action: 'delay_started',
      delay,
      scheduledFor: new Date(Date.now() + delay * 1000)
    };
  }

  private async executeSendTemplate(node: any, context: ExecutionContext) {
    const templateId = node.data?.templateId;
    console.log("node & context", node, context);

    if (!templateId) {
      throw new Error('No template ID provided');
    }

    if (!context.contactId) {
      throw new Error('No contact ID in context');
    }
    if (!context.conversationId) {
      throw new Error('No conversation ID in context');
    }

    const getContact = await db.query.contacts.findFirst({
      where: eq(contacts?.id, context.contactId),
    });

    if (!getContact?.phone) {
      throw new Error('Contact phone number not found');
    }

    console.log(`📄 Sending template ${templateId} to conversation ${context.conversationId}`);

    if (!getContact?.channelId) {
      throw new Error("Contact has no channelId");
    }

    const getTemplate = await db.query.templates.findFirst({
      where: and(
        eq(templates.id, templateId),
        eq(templates.channelId, getContact.channelId)
      )
    });

    if (!getContact?.channelId) {
      throw new Error('channelId not found');
    }
    if (getContact?.phone) {
      await sendBusinessMessage({
        to: getContact?.phone,
        templateName: getTemplate?.name || '',
        parameters: node.data?.parameters || [],
        language: getTemplate?.language || 'en_US',
        channelId: getContact?.channelId,
      });
    }

    console.log(`✅ Template sent: ${templateId}`);

    return {
      action: 'template_sent',
      templateId,
      conversationId: context.conversationId
    };
  }

  private async executeAssignUser(node: any, context: ExecutionContext) {
    const assigneeId = node.data?.assigneeId;

    if (!assigneeId) {
      throw new Error('No assignee ID provided');
    }

    console.log(`👤 Assigning conversation ${context.conversationId} to user ${assigneeId}`);

    if (!context.conversationId) {
      throw new Error("No conversationId provided in context");
    }

    const conversation = await storage.updateConversation(context.conversationId, { assignedTo: assigneeId, status: "assigned" });

    if (!conversation) {
      throw new Error('Conversation not found for assignment');
    }
    console.log(`✅ Conversation assigned to: ${assigneeId}`);

    return {
      action: 'user_assigned',
      assigneeId,
      conversationId: context.conversationId
    };
  }

  getPendingExecutions() {
    return Array.from(this.pendingExecutions.entries()).map(([pendingId, execution]) => ({
      pendingId,
      executionId: execution.executionId,
      conversationId: execution.conversationId,
      nodeId: execution.nodeId,
      contactId: execution.contactId,
      saveAs: execution.saveAs,
      timestamp: execution.timestamp,
      waitingTime: Date.now() - execution.timestamp.getTime()
    }));
  }

  hasPendingExecution(conversationId: string): boolean {
    return this.findPendingExecutionByConversation(conversationId) !== null;
  }

  async cleanupExpiredExecutions(timeoutMs: number = 30 * 60 * 1000) { // 30 minutes default
    const now = Date.now();
    const expired: { pendingId: string; execution: PendingExecution }[] = [];

    for (const [pendingId, execution] of this.pendingExecutions.entries()) {
      if (now - execution.timestamp.getTime() > timeoutMs) {
        expired.push({ pendingId, execution });
      }
    }

    for (const { pendingId, execution } of expired) {
      this.pendingExecutions.delete(pendingId);

      // Mark execution as failed due to timeout
      await this.completeExecution(
        execution.executionId,
        'failed',
        'Execution timed out waiting for user response'
      );

      console.warn(`⚠️  Cleaned up expired execution: ${pendingId} (conversation: ${execution.conversationId})`);
    }

    return expired.length;
  }

  async cancelExecution(conversationId: string): Promise<boolean> {
    const pending = this.findPendingExecutionByConversation(conversationId);
    if (pending) {
      this.pendingExecutions.delete(pending.pendingId);
      await this.completeExecution(pending.executionId, 'failed', 'Execution cancelled by user');
      console.log(`❌ Cancelled execution for conversation: ${conversationId}`);
      return true;
    }
    return false;
  }

  private async completeExecution(executionId: string, status: 'completed' | 'failed', result: string) {
    await db.update(automationExecutions)
      .set({
        status,
        completedAt: new Date(),
        result
      })
      .where(eq(automationExecutions.id, executionId));

    console.log(`🏁 Execution ${executionId} ${status}: ${result}`);
  }

  private async logNodeExecution(
    executionId: string,
    nodeId: string,
    nodeType: string,
    status: string,
    input: any,
    output: any,
    error: string | null
  ) {
    await db.insert(automationExecutionLogs).values({
      executionId,
      nodeId,
      nodeType,
      status,
      input: JSON.stringify(input),
      output: JSON.stringify(output),
      error
    });
  }

  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  private async getAutomationWithFlow(automationId: string) {
    // Get automation
    const automation = await db.query.automations.findFirst({
      where: eq(automations.id, automationId),
      with: {
        nodes: true,
        edges: true,
      },
    });

    return automation;
  }
}

// Trigger Manager - handles when automations should start
export class AutomationTriggerService {
  private executionService: AutomationExecutionService;

  constructor() {
    this.executionService = new AutomationExecutionService();
  }

  /**
   * Handle new conversation trigger
   */
  async handleNewConversation(conversationId: string, channelId: string, contactId?: string) {
    console.log(`🎯 New conversation trigger: ${conversationId}`);

    // Find active automations with "new_conversation" trigger
    const activeAutomations = await db.select()
      .from(automations)
      .where(and(
        eq(automations.channelId, channelId),
        eq(automations.trigger, 'new_conversation'),
        eq(automations.status, 'active')
      ));

    console.log(`Found ${activeAutomations.length} active automation(s)`);

    // Start execution for each automation
    for (const automation of activeAutomations) {
      try {
        // Create execution record
        const [execution] = await db.insert(automationExecutions).values({
          automationId: automation.id,
          contactId,
          conversationId,
          triggerData: {
            trigger: 'new_conversation',
            channelId,
            timestamp: new Date()
          },
          status: 'running'
        }).returning();

        // Start execution
        await this.executionService.executeAutomation(execution.id);

      } catch (error) {
        console.error(`Failed to execute automation ${automation.id}:`, error);
      }
    }
  }

  /**
   * Handle message received trigger - ENHANCED for conditions
   */
  // async handleMessageReceived(conversationId: string, message: any, channelId: string, contactId?: string) {
  //   console.log(`💬 Message received trigger: ${conversationId}`);

  //   // First, check if this is a response to a pending user_reply node
  //   if (this.executionService.hasPendingExecution(conversationId)) {
  //     console.log(`📨 Processing as user response to pending execution`);
  //     try {
  //       await this.executionService.handleUserResponse(conversationId, message.content || message.text || message, message.interactive);
  //       return; // Don't trigger new automations if this was a response
  //     } catch (error) {
  //       console.error(`Error handling user response:`, error);
  //       // Continue to trigger new automations as fallback
  //     }
  //   }

  //   // Normal message-based automation triggers
  //   const activeAutomations = await db.select()
  //     .from(automations)
  //     .where(and(
  //       eq(automations.channelId, channelId),
  //       eq(automations.trigger, 'message_received'),
  //       eq(automations.status, 'active')
  //     ));

  //   for (const automation of activeAutomations) {
  //     try {
  //       const [execution] = await db.insert(automationExecutions).values({
  //         automationId: automation.id,
  //         contactId,
  //         conversationId,
  //         triggerData: {
  //           trigger: 'message_received',
  //           message,
  //           channelId,
  //           timestamp: new Date()
  //         },
  //         status: 'running'
  //       }).returning();

  //       await this.executionService.executeAutomation(execution.id);
  //     } catch (error) {
  //       console.error(`Failed to execute automation ${automation.id}:`, error);
  //     }
  //   }
  // }

  async handleMessageReceived(conversationId: string, message: any, channelId: string, contactId?: string) {
    console.log(`💬 Message received trigger: ${conversationId}`);
    console.log(`🔍 Channel ID: ${channelId}, Contact ID: ${contactId}`);
    console.log(`📝 Message: "${message.content || message.text || message}"`);

    // First, check if this is a response to a pending user_reply node
    if (this.executionService.hasPendingExecution(conversationId)) {
      console.log(`📨 Processing as user response to pending execution`);
      try {
        await this.executionService.handleUserResponse(conversationId, message.content || message.text || message, message.interactive);
        return; // Don't trigger new automations if this was a response
      } catch (error) {
        console.error(`Error handling user response:`, error);
        // Continue to trigger new automations as fallback
      }
    }

    // DEBUG: Show all automations for this channel first
    const allAutomations = await db.select()
      .from(automations)
      .where(eq(automations.channelId, channelId));

    console.log(`📊 Total automations for channel ${channelId}: ${allAutomations.length}`);
    allAutomations.forEach(auto => {
      console.log(`   - ID: ${auto.id}, Name: "${auto.name}", Trigger: ${auto.trigger}, Status: ${auto.status}`);
    });

    // Normal message-based automation triggers
    const activeAutomations = await db.select()
      .from(automations)
      .where(and(
        eq(automations.channelId, channelId),
        eq(automations.status, 'active')
      ));

    console.log(`🎯 Found ${activeAutomations.length} active message_received automation(s)`);

    if (activeAutomations.length === 0) {
      console.warn(`⚠️ No active automations found for message_received trigger on channel ${channelId}`);
      return;
    }

    for (const automation of activeAutomations) {
      console.log(`🚀 Starting automation: ${automation.id} - "${automation.name}"`);

      try {
        // Check if automation has nodes
        const nodeCount = await db.select({ count: sql`count(*)` })
          .from(automationNodes)
          .where(eq(automationNodes.automationId, automation.id));

        console.log(`🔗 Automation ${automation.id} has ${nodeCount[0]?.count || 0} nodes`);

        if (!nodeCount[0]?.count || nodeCount[0].count === 0) {
          console.warn(`⚠️ Automation ${automation.id} has no nodes, skipping`);
          continue;
        }

        const [execution] = await db.insert(automationExecutions).values({
          automationId: automation.id,
          contactId,
          conversationId,
          triggerData: {
            trigger: 'message_received',
            message,
            channelId,
            timestamp: new Date()
          },
          status: 'running'
        }).returning();

        console.log(`✅ Created execution record: ${execution.id}`);

        await this.executionService.executeAutomation(execution.id);

        console.log(`🎉 Automation ${automation.id} execution completed`);

      } catch (error) {
        console.error(`❌ Failed to execute automation ${automation.id}:`, error);
        console.error(`Stack trace:`, (error as Error).stack);
      }
    }
  }

  /**
   * Get execution service for external access
   */
  getExecutionService() {
    return this.executionService;
  }
}

// Export singleton instances
export const executionService = new AutomationExecutionService();
export const triggerService = new AutomationTriggerService();

// Periodic cleanup (run this somewhere in your app)
setInterval(() => {
  executionService.cleanupExpiredExecutions();
}, 5 * 60 * 1000); // Every 5 minutes